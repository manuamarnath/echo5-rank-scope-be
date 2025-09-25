/**
 * Comprehensive AI Content Generation Prompt Template (Node.js version)
 */

const CONTENT_GENERATION_PROMPT = `
As a senior content writer and SEO specialist for [Business Name], your task is to create engaging, plagiarism-free content for the website's inner pages (e.g., [Page Name Examples: Service 1, Service 2, Product 1]) at [Website URL]. The content must reflect the business's identity, optimize for SEO, AEO (Answer Engine Optimization for voice/AI searches), and GEO (local SEO for [Business Location City], serving [Primary Service Area]), and allocate a provided list of 25+ keywords to the most relevant pages. Below is everything you need to know about the business, the keywords, and how to structure the content.

### Business Background
[Business Name] is a [Business Type] located at [Business Address], a [Location Description]. We serve [Service Areas]. Our unique selling points (USPs) are:
- [USP1]
- [USP2]
- [USP3]
- [USP4]
- [USP5]
- [Services]
- [Website Structure]
- [Target Audience]
- [Tone]
- [SEO Goals]

### Keywords to Allocate
Below is the list of 25+ keywords to be distributed across the website's pages. Allocate each keyword to the most relevant page based on its service focus (e.g., keywords containing "service" to Service page). Ensure all keywords appear visibly in content (headings, text, FAQs) for SEO and AEO, not just meta tags. Here's the full list:
[Insert Client's 25+ Keywords Here]

**Keyword Allocation Logic**:
- Assign keywords based on page focus (e.g., keywords containing "service" to Service page).
- Ensure 5-8 relevant keywords per page, integrated naturally in headings, text, and FAQs.
- Include [Primary GEO Keyword] and the address ([Business Address]) on every page for GEO consistency.
- Use secondary keywords where relevant to support broader SEO.

### Task: Create Inner Page Content
Create a 800-1000 word, plagiarism-free page for [Page Name] at [Page URL] in human-style writing (conversational, empathetic, engaging). The content must be optimized for WordPress/Elementor, with sections for easy widget use (Heading, Text Editor, Button, HTML, Shortcode). Follow this structure:

1. **Meta Information**:
   - **Title**: 60-70 characters, keyword-first (e.g., "[Primary Keyword] | [GEO USP]"), include [Primary Service Area] and [Business Location City].
   - **Description**: 150-160 characters, persuasive with CTA (e.g., "Discover [service] in [Primary Service Area] at our [Business Location City] showroom. Free consultation!").
   - **Keywords**: List 10 core keywords plus 3-5 page-specific keywords from the 25+ list.
   - **Canonical URL**: Use the page's slug (e.g., [Page URL]).
   - **Robots**: index, follow.

2. **Hero Section**:
   - **H1**: Primary keyword with [Primary Service Area] and [Business Location City] (e.g., "[Service] [Primary Service Area] from [Business Location City]'s Trusted Store").
   - **Text**: 100-150 words introducing the service, USPs, and [Business Address]. End with a CTA.
   - **Button**: "Book a Free Consultation" (link to /contact/).

3. **Why Choose Us Section**:
   - **H2**: "Why Choose Our [Service] in [Primary Service Area]".
   - **Text**: 150-200 words with bullet points highlighting benefits (e.g., [USP1], [USP2]).

4. **About Us Section**:
   - **H2**: "About [Business Name]".
   - **Text**: 150-200 words on business background, [Business Location City] showroom, services, and client focus.

5. **FAQ Section (AEO Focus)**:
   - **H2**: "Frequently Asked Questions About [Service]".
   - **Questions**: 5-6 H3 questions with 50-60 word answers, using page-specific keywords.
   - **Examples**:
     - Why choose [service] in [Primary Service Area]?
     - How much does [service] cost in [Primary Service Area]?
     - How long does [service] take in [Primary Service Area]?

6. **CTA Section**:
   - **H2**: "Start Your [Primary Service Area] [Service] Today".
   - **Text**: 100-150 words with strong CTA, mentioning [Business Location City] showroom.

7. **Schema Markup (GEO & AEO)**:
   - **LocalBusiness Schema**:
   - **FAQPage Schema**:
   - **Service Schema**:

Now, create the content for [Page Name] at [Page URL] using the provided structure and keyword allocation logic. Ensure it's 800-1000 words, plagiarism-free, and optimized for SEO, AEO, and GEO.
`;

module.exports = {
  CONTENT_GENERATION_PROMPT
};