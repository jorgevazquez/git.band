# Deployment Guide

Deploy the git.band site to AWS S3 and CloudFront.

## Prerequisites

- AWS account with S3 bucket and (optionally) CloudFront distribution
- AWS CLI configured with credentials, OR AWS credentials in environment variables
- Node.js 18+ (for TypeScript deploy script)

## Setup

1. **Create S3 bucket** (if not already created)
   ```bash
   aws s3 mb s3://git-band-site --region us-east-1
   ```

2. **Configure environment variables**
   
   Copy `.env.example.deploy` and fill in your values:
   ```bash
   cp .env.example.deploy .env.local
   ```

   Required variables:
   - `S3_BUCKET` - Your S3 bucket name
   - `AWS_REGION` - AWS region (default: us-east-1)
   - `CLOUDFRONT_DISTRIBUTION_ID` - Optional, for cache invalidation

3. **Install dependencies**
   ```bash
   npm install
   ```

## Usage

### TypeScript Deploy Script (Recommended)

**Dry run** (preview what will be uploaded):
```bash
npm run deploy:dry
```

**Deploy to S3**:
```bash
npm run deploy
```

The script will:
- Sync all files to S3 (excluding `.git/`, `.env`, `scripts/`, etc.)
- Set appropriate cache control headers:
  - HTML/JSON: 5 minutes
  - CSS/JS/Media: 1 year
- Delete files from S3 that no longer exist locally
- Invalidate CloudFront cache (if `CLOUDFRONT_DISTRIBUTION_ID` is set)

### Bash Deploy Script

If you prefer bash:

**Dry run**:
```bash
DRY_RUN=true bash scripts/deploy.sh
```

**Deploy**:
```bash
bash scripts/deploy.sh
```

## CloudFront Setup

If using CloudFront to serve the site:

1. Create a CloudFront distribution pointing to your S3 bucket
2. Set the distribution ID in `.env.local`:
   ```
   CLOUDFRONT_DISTRIBUTION_ID=E1ABCDEF123456
   ```
3. The deploy script will automatically invalidate the cache after upload

## Cache Control Strategy

- **index.html**: 5 minutes (max-age=300)
  - Allows frequent updates without long waits for client cache expiry
- **HTML files**: 5 minutes
- **JSON data**: 5 minutes
- **CSS/JS**: 1 year
  - Assumes versioning via filename changes
- **Images/Audio**: 1 year
  - Assumes content-addressed or versioned filenames

## Troubleshooting

**"S3 bucket not found"**: Verify bucket name and AWS credentials

**"Access Denied"**: Check that your AWS credentials have S3 and CloudFront permissions

**CloudFront not updating**: Ensure `CLOUDFRONT_DISTRIBUTION_ID` is set correctly and credentials have CloudFront permissions

**Files not uploading**: Run with `DRY_RUN=true` to see what would happen without making changes
