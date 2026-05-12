/** @type {import('next').NextConfig} */
const nextConfig = {
  // Move it out of 'experimental' and put it here
  allowedDevOrigins: ['192.168.1.5', 'localhost:3000'],
  
  // Keep your other settings below...
};

module.exports = nextConfig;