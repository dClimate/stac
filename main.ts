import { createVerifiedFetch } from "@helia/verified-fetch";
import { createHelia, type Helia } from "helia";
import { bootstrap } from "@libp2p/bootstrap";
import { webSockets } from "@libp2p/websockets";
import { multiaddr } from "@multiformats/multiaddr";
import { webRTC } from "@libp2p/webrtc";
// import { circuitRelayTransport } from "@libp2p/circuit-relay";

export const FLUORINE_WEBSOCKETS =
	"/dns4/15-235-14-184.k51qzi5uqu5dj2rauyi7u92l2sldj7dkdhn18f4qccfvcyeca4ym7cveuv4qjl.libp2p.direct/tcp/4001/tls/ws/p2p/12D3KooWHdZM98wcuyGorE184exFrPEJWv2btXWWSHLQaqwZXuPe";

export const BISMUTH_WEBSOCKETS =
	"/dns4/40-160-21-102.k51qzi5uqu5dhy22gw9bhnr0ouwxub8ct5awrlfm3l698aj0gekrexa4g0epau.libp2p.direct/tcp/4001/tls/ws/p2p/12D3KooWEaVCpKd2MgZeLugvwCWRSQAMYWdu6wNG6SySQsgox8k5";

export const CERIUM_WEBSOCKETS =
	"/dns4/15-235-86-198.k51qzi5uqu5dinxpj5iu3anaalt5ea7g0iy8al2bzejnljokrdy8hjp4cl4410.libp2p.direct/tcp/4001/tls/ws/p2p/12D3KooWGX5HDDjbdiJL2QYf2f7Kjp1Bj6QAXR5vFvLQniTKwoBR";

/**
 * Function to connect helia node to the cluster nodes that have dclimate data
 * @param node helia node used to connect to the cluster
 */
const connectToCluster = async (node) => {
	try {
		const connectionFluorine = await dialWithAbortSignal(
			node,
			FLUORINE_WEBSOCKETS,
		);
		console.log(
			"Successfully connected to Fluorine node:",
			connectionFluorine.remotePeer.toString(),
		);

		const connectionBismuth = await dialWithAbortSignal(
			node,
			BISMUTH_WEBSOCKETS,
		);
		console.log(
			"Successfully connected to Bismuth node:",
			connectionBismuth.remotePeer.toString(),
		);

		const connectionCerium = await dialWithAbortSignal(node, CERIUM_WEBSOCKETS);
		console.log(
			"Successfully connected to Cerium node:",
			connectionCerium.remotePeer.toString(),
		);
	} catch (error) {
		console.warn("Failed to connect to target peer:", error);
	}
};

/**
 * Function to dial to a peer with a abort signal
 * @param node node used to dial
 * @param multiaddressString multiaddress of the peer to dial
 * @returns connection to the peer
 */
const dialWithAbortSignal = async (node, multiaddressString) => {
	// Create an abort controller with a longer timeout
	const controller = new AbortController();
	const timeoutId = setTimeout(() => {
		controller.abort(new Error("Connection attempt timed out"));
	}, 60000); // 60 seconds timeout

	try {
		const addr = multiaddr(multiaddressString);

		const connection = await node.libp2p.dial(addr, {
			signal: controller.signal,
		});

		// Clear the timeout if connection is successful
		clearTimeout(timeoutId);

		console.log("Connection established:", {
			remotePeer: connection.remotePeer.toString(),
			status: connection.status,
		});

		return connection;
	} catch (error) {
		// Clear the timeout to prevent memory leaks
		clearTimeout(timeoutId);

		console.error("Dial attempt failed:", {
			errorName: error.name,
			errorMessage: error.message,
			stack: error.stack,
		});

		// Provide more context for common error types
		if (error.name === "AbortError") {
			console.warn(
				"Connection attempt was aborted. Possible reasons:",
				"- Network connectivity issues",
				"- Target peer is unreachable",
				"- Connection took too long to establish",
			);
		}

		throw error;
	}
};

let verifiedFetch: ReturnType<typeof createVerifiedFetch>;
let helia: Helia;
async function runDemo() {
	try {
		helia = await createHelia({
			libp2p: {
				transport: [webSockets(), webRTC()],
				peerDiscovery: [
					bootstrap({
						list: [FLUORINE_WEBSOCKETS, BISMUTH_WEBSOCKETS, CERIUM_WEBSOCKETS],
						timeout: 30000, // Increased timeout
						tagName: "cluster-peer",
					}),
				],
			},
		});
		await connectToCluster(helia);
		verifiedFetch = await createVerifiedFetch(helia);

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
