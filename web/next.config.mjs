/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["mongoose", "bullmq", "ioredis", "archiver", "nodemailer"],
  },
};

export default nextConfig;
