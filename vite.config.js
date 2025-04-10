// vite.config.js
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
	// ... other config
	plugins: [
		nodePolyfills({
			protocolImports: true,
			// You might not even need nodePolyfills if alias works,
			// but keeping it might polyfill other things like 'buffer'.
		}),
	],
	resolve: {
		alias: {
			crypto: "crypto-browserify", // Add this alias
		},
	},
	// ... rest of config
});
