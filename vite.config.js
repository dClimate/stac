// vite.config.js
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
	base: "/", // Ensure this is correct for GitHub Pages (usually '/')
	server: {
		port: 3000,
		open: true,
	},
	build: {
		outDir: "dist",
		sourcemap: true,
	},
	plugins: [
		nodePolyfills({
			// To exclude specific polyfills, add them to this list.
			// By default, it includes polyfills for most Node.js built-ins.
			exclude: [],
			// Whether to polyfill `node:` protocol imports.
			protocolImports: true,
			// Specific modules to include/exclude could be configured here if needed
			// e.g., globals: { Buffer: true, global: true, process: true }
			//       protocolImports: true
		}),
	],
	// Optional but sometimes helpful: Explicitly alias 'crypto' if issues persist
	// resolve: {
	//   alias: {
	//     crypto: 'crypto-browserify', // Requires pnpm add -D crypto-browserify
	//   },
	// },
	// Optional: Ensure target supports top-level await and other features
	// build: {
	//   target: 'esnext' // or 'es2020' / 'es2022'
	// }
});
