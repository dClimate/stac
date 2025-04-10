import { verifiedFetch } from "@helia/verified-fetch";

async function runDemo() {
	try {
		const response = await verifiedFetch(
			"ipns://k51qzi5uqu5dk89atnl883sr0g1cb2py631ckz9ng45qhk6dg0pj141jtxtx6l",
		);

		const results = await response.json();

		// Format the results as nicely indented JSON
		const formattedJson = JSON.stringify(results, null, 2);

		const jsonOutput = document.getElementById("json-output");
		if (jsonOutput) {
			// Set the text content first to preserve formatting
			jsonOutput.textContent = formattedJson;

			// Then modify the DOM to make IPFS links clickable
			makeIpfsLinksClickable(jsonOutput);
		}
	} catch (error) {
		console.error("Error:", error);
		document.body.innerHTML = `<pre style="color: red;">Error: ${error instanceof Error ? error.message : String(error)}</pre>`;
	}
}

/**
 * Finds text nodes containing IPFS links in a DOM element and replaces them with clickable links
 */
function makeIpfsLinksClickable(element: HTMLElement) {
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

	const textNodes: Text[] = [];
	let currentNode = walker.nextNode();

	// Collect all text nodes
	while (currentNode) {
		textNodes.push(currentNode as Text);
		currentNode = walker.nextNode();
	}

	// Process each text node to replace IPFS links with clickable elements
	for (const textNode of textNodes) {
		const content = textNode.textContent || "";
		if (content.includes("/ipfs/")) {
			// Create a temporary container
			const container = document.createElement("span");

			// Set its content with IPFS links replaced with anchor elements
			container.innerHTML = content.replace(
				/(https?:\/\/[^\s"]*\/ipfs\/[^\s"]*|ipfs:\/\/[^\s"]*|\/ipfs\/[^\s"]*)/g,
				(match) => {
					// Normalize to IPFS URL format
					const ipfsUrl = normalizeIpfsUrl(match);
					return `<a href="#" class="ipfs-link" data-ipfs-url="${ipfsUrl}" 
						onclick="fetchAndDisplayIpfsContent('${ipfsUrl}'); return false;">${match}</a>`;
				},
			);

			// Replace the original text node with the new container
			textNode.parentNode?.replaceChild?.(container, textNode);
		}
	}
}

/**
 * Normalizes different IPFS path formats to a standardized ipfs:// URL
 */
function normalizeIpfsUrl(url: string): string {
	if (url.startsWith("ipfs://")) {
		return url;
	}

	if (url.startsWith("/ipfs/")) {
		return `ipfs://${url.substring(6)}`;
	}

	// For URLs like http://example.com/ipfs/Qm...
	const ipfsMatch = url.match(/\/ipfs\/([^\/\s"]*)/);
	if (ipfsMatch && ipfsMatch[1]) {
		return `ipfs://${ipfsMatch[1]}`;
	}

	return url;
}

/**
 * Escapes HTML special characters in a string
 */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Fetches content from an IPFS URL using verifiedFetch and updates the page
 */
async function fetchAndDisplayIpfsContent(ipfsUrl: string) {
	try {
		document.body.innerHTML = "<p>Loading content from IPFS...</p>";

		const response = await verifiedFetch(ipfsUrl);

		// Try to parse as JSON first
		try {
			const contentType = response.headers.get("content-type");

			if (contentType?.includes("application/json")) {
				const jsonData = await response.json();

				// Format the JSON with indentation
				const formattedJson = JSON.stringify(jsonData, null, 2);

				// Create the pre element and set its text content
				const preElement = document.createElement("pre");
				preElement.id = "json-output";
				preElement.textContent = formattedJson;

				// Clear the body and append the pre element
				document.body.innerHTML = "";
				document.body.appendChild(preElement);

				// Make IPFS links clickable
				makeIpfsLinksClickable(preElement);
			} else {
				// Handle as text/html
				const text = await response.text();

				// Check if it looks like HTML
				if (text.trim().startsWith("<") && text.includes("</")) {
					document.body.innerHTML = text;
				} else {
					document.body.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
				}
			}
		} catch (parseError) {
			// If not JSON, display as text
			const text = await response.text();
			document.body.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
		}
	} catch (error) {
		console.error("Error fetching IPFS content:", error);
		document.body.innerHTML = `<pre style="color: red;">Error fetching IPFS content: ${error instanceof Error ? error.message : String(error)}</pre>`;
	}
}

// Make the fetchAndDisplayIpfsContent function globally available for onclick handlers
declare global {
	interface Window {
		fetchAndDisplayIpfsContent: typeof fetchAndDisplayIpfsContent;
	}
}
window.fetchAndDisplayIpfsContent = fetchAndDisplayIpfsContent;

runDemo();
