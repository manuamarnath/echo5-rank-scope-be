// Reporting endpoint: generate weekly internal report, upload to S3/Backblaze, return signed URL
const express = require('express');
const router = express.Router();
const Keyword = require('../models/Keyword');
const Page = require('../models/Page');
const Brief = require('../models/Brief');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Parser } = require('json2csv');

// Configure AWS SDK v3 S3 client for S3/Backblaze B2 (S3-compatible)
const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT || 'https://s3.us-west-001.backblazeb2.com',
  region: process.env.B2_REGION || 'us-west-001',
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME || 'rankscope-reports';

// Generate report and upload
router.post('/internal-report', auth(['owner', 'employee']), async (req, res) => {
  try {
    // Aggregate stats
    const totalPages = await Page.countDocuments();
    const totalKeywords = await Keyword.countDocuments();
    const totalBriefs = await Brief.countDocuments();
    const totalTasks = await Task.countDocuments();
    
    // Get detailed breakdowns
    const keywordStats = await Keyword.aggregate([
      {
        $group: {
          _id: '$intent',
          count: { $sum: 1 },
          avgVolume: { $avg: '$volume' }
        }
      }
    ]);
    
    const taskStats = await Task.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const pageStats = await Page.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Generate CSV report
    const reportData = {
      summary: {
        totalPages,
        totalKeywords,
        totalBriefs,
        totalTasks,
        generatedAt: new Date().toISOString()
      },
      keywordBreakdown: keywordStats,
      taskBreakdown: taskStats,
      pageBreakdown: pageStats
    };

    // Convert to CSV
    const parser = new Parser();
    const csv = parser.parse([reportData.summary]);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `internal-report-${timestamp}.csv`;
    
    // Upload to S3/Backblaze
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: `reports/${filename}`,
      Body: csv,
      ContentType: 'text/csv',
      ACL: 'private'
    };
    
    // Upload using PutObjectCommand
    const putCmd = new PutObjectCommand({
      Bucket: uploadParams.Bucket,
      Key: uploadParams.Key,
      Body: uploadParams.Body,
      ContentType: uploadParams.ContentType,
      ACL: uploadParams.ACL
    });

    const uploadResult = await s3Client.send(putCmd);

    // Generate signed URL (valid for 7 days)
    const signedUrl = await getSignedUrl(s3Client, new (require('@aws-sdk/client-s3').GetObjectCommand)({
      Bucket: BUCKET_NAME,
      Key: `reports/${filename}`
    }), { expiresIn: 7 * 24 * 60 * 60 });

    res.json({ 
      summary: reportData.summary,
      keywordBreakdown: keywordStats,
      taskBreakdown: taskStats,
      pageBreakdown: pageStats,
      reportUrl: signedUrl,
      filename,
      uploadedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get list of available reports
router.get('/reports', auth(['owner', 'employee']), async (req, res) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: 'reports/'
    };
    
    const listCmd = new ListObjectsV2Command(params);
    const result = await s3Client.send(listCmd);
    const reports = (result.Contents || []).map(obj => ({
      filename: obj.Key.replace('reports/', ''),
      size: obj.Size,
      lastModified: obj.LastModified,
      url: null // will be filled below
    }));

    // Generate presigned URLs for each object (24 hours)
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    for (let i = 0; i < reports.length; i++) {
      const key = `reports/${reports[i].filename}`;
      try {
        reports[i].url = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }), { expiresIn: 24 * 60 * 60 });
      } catch (err) {
        console.error('Error generating presigned URL for', key, err);
        reports[i].url = null;
      }
    }
    
    res.json(reports);
  } catch (err) {
    console.error('Error listing reports:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
