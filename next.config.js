/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a verification build use a separate folder (NEXT_DIST_DIR) so it never
  // overwrites the .next folder of a running `npm run dev`
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Keeps Prisma out of the server bundle (works for both Turbopack and webpack)
  serverExternalPackages: ['@prisma/client', 'prisma'],
  // Configure external images for Cloudinary
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Ensure API routes work properly
  async rewrites() {
    return []
  }
}

module.exports = nextConfig