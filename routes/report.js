// Reporting endpoint: generate weekly internal report, upload to S3/Backblaze, return signed URL
const express = require('express');
const router = express.Router();
const Keyword = require('../models/Keyword');
const Page = require('../models/Page');
const Brief = require('../models/Brief');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const AWS = require('aws-sdk');
const { Parser } = require('json2csv');

// Configure AWS SDK for S3/Backblaze B2
const s3 = new AWS.S3({
  endpoint: process.env.B2_ENDPOINT || 'https://s3.us-west-001.backblazeb2.com',
  accessKeyId: process.env.B2_ACCESS_KEY_ID,
  secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
  region: process.env.B2_REGION || 'us-west-001',
  s3ForcePathStyle: true,
  signatureVersion: 'v4'
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
    
    const uploadResult = await s3.upload(uploadParams).promise();
    
    // Generate signed URL (valid for 7 days)
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: BUCKET_NAME,
      Key: `reports/${filename}`,
      Expires: 7 * 24 * 60 * 60 // 7 days
    });

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
    
    const result = await s3.listObjectsV2(params).promise();
    const reports = result.Contents?.map(obj => ({
      filename: obj.Key.replace('reports/', ''),
      size: obj.Size,
      lastModified: obj.LastModified,
      url: s3.getSignedUrl('getObject', {
        Bucket: BUCKET_NAME,
        Key: obj.Key,
        Expires: 24 * 60 * 60 // 24 hours
      })
    })) || [];
    
    res.json(reports);
  } catch (err) {
    console.error('Error listing reports:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
