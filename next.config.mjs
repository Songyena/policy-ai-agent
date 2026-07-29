/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse가 의존하는 @napi-rs/canvas는 네이티브 바이너리라 서버 번들에 포함하지 않고
  // node_modules에서 그대로 require해야 한다.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
