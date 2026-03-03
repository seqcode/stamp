/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["mongoose", "bullmq", "ioredis", "archiver", "nodemailer", "unzipper"],
  },
  webpack: (config) => {
    // unzipper optionally imports @aws-sdk/client-s3 for S3 support;
    // we only use the streaming Parse API, so stub the missing module.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@aws-sdk/client-s3": false,
    };
    return config;
  },
};

export default nextConfig;
