/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This host has many shared cores. Keep static generation bounded rather
  // than spawning one worker for nearly every visible CPU.
  experimental: { cpus: 2 },
}

module.exports = nextConfig
