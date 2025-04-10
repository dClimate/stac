import { createVerifiedFetch, type VerifiedFetch } from "@helia/verified-fetch";
import { createHelia } from "helia";
import { bootstrap } from "@libp2p/bootstrap";
import { webSockets } from "@libp2p/websockets";
import { multiaddr } from "@multiformats/multiaddr";
import { webRTC } from "@libp2p/webrtc";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";

// Type for the helia instance and communication functions
interface HeliaNode {
	libp2p: {
		dial: (addr: any, options?: any) => Promise<any>;
	};
}

// Type definition for page state
interface PageState {
	ipfsUrl?: string;
	content?: string;
	contentType?: string;
}

export const FLUORINE_WEBSOCKETS =
	"/dns4/15-235-14-184.k51qzi5uqu5dj2rauyi7u92l2sldj7dkdhn18f4qccfvcyeca4ym7cveuv4qjl.libp2p.direct/tcp/4001/tls/ws/p2p/12D3KooWHdZM98wcuyGorE184exFrPEJWv2btXWWSHLQaqwZXuPe";

export const BISMUTH_WEBSOCKETS =
	"/dns4/40-160-21-102.k51qzi5uqu5dhy22gw9bhnr0ouwxub8ct5awrlfm3l698aj0gekrexa4g0epau.libp2p.direct/tcp/4001/tls/ws/p2p/12D3KooWEaVCpKd2MgZeLugvwCWRSQAMYWdu6wNG6SySQsgox8k5";

export const CERIUM_WEBSOCKETS =
	"/dns4/15-235-86-198.k51qzi5uqu5dinxpj5iu3anaalt5ea7g0iy8al2bzejnljokrdy8hjp4cl4410.libp2p.direct/tcp/4001/tls/ws/p2p/12D3KooWGX5HDDjbdiJL2QYf2f7Kjp1Bj6QAXR5vFvLQniTKwoBR";

// Default IPNS URL to load initially
const DEFAULT_IPNS_URL =
	"ipns://k51qzi5uqu5dk89atnl883sr0g1cb2py631ckz9ng45qhk6dg0pj141jtxtx6l";

/**
 * Function to connect helia node to the cluster nodes that have dclimate data
 * @param node helia node used to connect to the cluster
 */
const connectToCluster = async (node: HeliaNode) => {
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
const dialWithAbortSignal = async (
	node: HeliaNode,
	multiaddressString: string,
) => {
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
	} catch (error: unknown) {
		// Clear the timeout to prevent memory leaks
		clearTimeout(timeoutId);

		console.error("Dial attempt failed:", {
			errorName: error instanceof Error ? error.name : "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : "No stack trace",
		});

		// Provide more context for common error types
		if (error instanceof Error && error.name === "AbortError") {
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

let verifiedFetchFn: VerifiedFetch;
let helia: HeliaNode;

// Store initial page content to return to
let initialPageContent = "";
// Store the initial loaded content for returning to home
let homePageContent = "";
// Keep track of whether the app has been initialized
let isInitialized = false;

/**
 * Initialize the application
 */
async function runDemo() {
	try {
		// Save the initial page content
		initialPageContent = document.body.innerHTML;

		// Prevent double initialization
		if (isInitialized) {
			return;
		}
		isInitialized = true;

		helia = await createHelia({
			libp2p: {
				transports: [webSockets(), webRTC(), circuitRelayTransport()],
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
		verifiedFetchFn = await createVerifiedFetch(helia);

		// Set up history popstate event handler
		setupHistoryNavigation();

		// Check if URL has a hash and try to load that IPFS content
		const initialUrl = getIpfsUrlFromHash();
		if (initialUrl) {
			await loadIpfsContent(initialUrl, false); // Don't push new state for initial load
		} else {
			// Load default content
			await loadInitialContent();
		}
	} catch (error) {
		console.error("Error:", error);
		document.body.innerHTML = `<pre style="color: red;">Error: ${error instanceof Error ? error.message : String(error)}</pre>`;
	}
}

/**
 * Load the default/initial content
 */
async function loadInitialContent() {
	try {
		document.body.innerHTML = "<p>Loading initial content...</p>";

		const response = await verifiedFetchFn(DEFAULT_IPNS_URL);
		const results = await response.json();

		// Format the results as nicely indented JSON
		const formattedJson = JSON.stringify(results, null, 2);

		// Create fresh elements to avoid reference issues
		const container = document.createElement("div");
		container.id = "content-container";

		const preElement = document.createElement("pre");
		preElement.id = "json-output";
		preElement.textContent = formattedJson;

		container.appendChild(preElement);

		// Clear and update the body
		document.body.innerHTML = "";
		document.body.appendChild(container);

		// Then modify the DOM to make IPFS links clickable
		makeIpfsLinksClickable(preElement);

		// Save the home content for later restoration
		homePageContent = document.body.innerHTML;

		// Set initial history state
		const pageState: PageState = {
			ipfsUrl: DEFAULT_IPNS_URL,
			content: homePageContent,
			contentType: "application/json",
		};

		// Replace current history entry instead of adding new one
		window.history.replaceState(pageState, "", window.location.pathname);
	} catch (error) {
		console.error("Error loading initial content:", error);
		document.body.innerHTML = `<pre style="color: red;">Error loading initial content: ${error instanceof Error ? error.message : String(error)}</pre>`;
	}
}

/**
 * Sets up navigation with browser history
 */
function setupHistoryNavigation() {
	// Handle back/forward browser navigation
	window.addEventListener("popstate", async (event) => {
		console.log("Navigation event:", event.state);

		try {
			const state = event.state as PageState | null;

			// If we have state with IPFS URL, load that content
			if (state?.ipfsUrl) {
				await loadIpfsContent(state.ipfsUrl, false);
			}
			// If we have state with stored content but no URL, use the content directly
			else if (state?.content) {
				document.body.innerHTML = state.content;

				// Reattach event handlers to any links
				const jsonOutput = document.getElementById("json-output");
				if (jsonOutput) {
					makeIpfsLinksClickable(jsonOutput);
				}
			}
			// If we have empty state or null state, return to home page
			else {
				if (homePageContent) {
					document.body.innerHTML = homePageContent;

					// Reattach event handlers to links
					const jsonOutput = document.getElementById("json-output");
					if (jsonOutput) {
						makeIpfsLinksClickable(jsonOutput);
					}
				} else {
					// If we don't have home content saved, reload it
					await loadInitialContent();
				}
			}
		} catch (error) {
			console.error("Error handling history navigation:", error);

			// Try to recover by loading initial content
			if (homePageContent) {
				document.body.innerHTML = homePageContent;

				// Reattach event handlers
				const jsonOutput = document.getElementById("json-output");
				if (jsonOutput) {
					makeIpfsLinksClickable(jsonOutput);
				}
			} else {
				await loadInitialContent();
			}
		}
	});
}

/**
 * Gets IPFS URL from the URL hash
 */
function getIpfsUrlFromHash(): string | null {
	const hash = window.location.hash;
	if (hash && hash.startsWith("#/ipfs/")) {
		return normalizeIpfsUrl(hash.substring(1)); // Remove the # symbol
	}
	return null;
}

/**
 * Updates URL hash without triggering navigation
 */
function updateUrlHash(ipfsUrl: string) {
	// Extract CID from ipfs:// URL and create URL hash
	const cid = ipfsUrl.replace("ipfs://", "");
	const newHash = `/ipfs/${cid}`;

	// Only update if hash would change
	if (window.location.hash !== `#${newHash}`) {
		window.location.hash = newHash;
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
					// Clean up the match by trimming any trailing whitespace or quotes
					const cleanMatch = match.trim().replace(/["']+$/, "");

					// Log the original and cleaned match to help with debugging
					console.log("Processing IPFS link:", {
						original: match,
						cleaned: cleanMatch,
					});

					// Normalize to IPFS URL format
					const ipfsUrl = normalizeIpfsUrl(cleanMatch);

					// Use a new router function with better debugging
					return `<a href="#${ipfsUrl.replace("ipfs://", "/ipfs/")}" 
						class="ipfs-link" 
						data-ipfs-url="${ipfsUrl}" 
						data-original-link="${cleanMatch}"
						onclick="routeToIpfsContent('${ipfsUrl}'); return false;">${cleanMatch}</a>`;
				},
			);

			// Replace the original text node with the new container
			if (textNode.parentNode) {
				textNode.parentNode.replaceChild(container, textNode);
			}
		}
	}
}

/**
 * Router function to handle IPFS link navigation
 */
async function routeToIpfsContent(ipfsUrl: string) {
	console.log("Routing to IPFS content:", ipfsUrl);
	await loadIpfsContent(ipfsUrl, true);
}

/**
 * Normalizes different IPFS path formats to a standardized ipfs:// URL
 */
function normalizeIpfsUrl(url: string): string {
	// Clean up the URL first by trimming and removing trailing characters that might break links
	const cleanUrl = url.trim().replace(/[,.:;'"]+$/, "");

	if (cleanUrl.startsWith("ipfs://")) {
		return cleanUrl;
	}

	if (cleanUrl.startsWith("/ipfs/")) {
		return `ipfs://${cleanUrl.substring(6)}`;
	}

	// For URLs like http://example.com/ipfs/Qm...
	const ipfsMatch = cleanUrl.match(/\/ipfs\/([^\/\s"]*)/);
	if (ipfsMatch?.[1]) {
		// Make sure CID is clean and doesn't have unwanted characters
		const cid = ipfsMatch[1].replace(/[,.;'"]$/, "");
		return `ipfs://${cid}`;
	}

	return cleanUrl;
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
 * Loads IPFS content and optionally updates browser history
 */
async function loadIpfsContent(ipfsUrl: string, updateHistory: boolean) {
	console.log("Loading IPFS content:", ipfsUrl);

	try {
		// Check if the URL is valid and has correct format
		if (
			!ipfsUrl ||
			(!ipfsUrl.startsWith("ipfs://") && !ipfsUrl.startsWith("ipns://"))
		) {
			console.error("Invalid IPFS URL format:", ipfsUrl);
			throw new Error(`Invalid IPFS URL format: ${ipfsUrl}`);
		}

		document.body.innerHTML = "<p>Loading content from IPFS...</p>";

		// Update URL hash first for better UX
		updateUrlHash(ipfsUrl);

		const response = await verifiedFetchFn(ipfsUrl);
		console.log("Response received:", {
			status: response.status,
			contentType: response.headers.get("content-type"),
			url: ipfsUrl,
		});

		const contentType = response.headers.get("content-type");
		let pageContent: string;
		let pageState: PageState;

		// Try to parse as JSON first
		try {
			if (contentType?.includes("application/json")) {
				const jsonData = await response.json();
				const formattedJson = JSON.stringify(jsonData, null, 2);

				// Create the pre element
				const container = document.createElement("div");
				container.id = "content-container";

				const preElement = document.createElement("pre");
				preElement.id = "json-output";
				preElement.textContent = formattedJson;

				container.appendChild(preElement);

				// Clear and update the body
				document.body.innerHTML = "";
				document.body.appendChild(container);

				// Make IPFS links clickable
				makeIpfsLinksClickable(preElement);

				// Store the generated content
				pageContent = document.body.innerHTML;

				// Store page state
				pageState = {
					ipfsUrl,
					content: pageContent,
					contentType: "application/json",
				};
			} else {
				// Handle as text/html
				const text = await response.text();
				let container = document.createElement("div");
				container.id = "content-container";

				// Check if it looks like HTML
				if (text.trim().startsWith("<") && text.includes("</")) {
					// For HTML content, create a container to hold it
					container.innerHTML = text;

					document.body.innerHTML = "";
					document.body.appendChild(container);

					// Find any pre elements in the loaded HTML and make their links clickable
					const preElements = document.querySelectorAll("pre");
					preElements.forEach((pre) => {
						makeIpfsLinksClickable(pre as HTMLElement);
					});
				} else {
					// For text content, display in pre tag
					const preElement = document.createElement("pre");
					preElement.textContent = escapeHtml(text);

					container.appendChild(preElement);

					document.body.innerHTML = "";
					document.body.appendChild(container);

					// Make sure to process any IPFS links in the text content
					makeIpfsLinksClickable(preElement);
				}

				// Store the generated content
				pageContent = document.body.innerHTML;

				// Store page state
				pageState = {
					ipfsUrl,
					content: pageContent,
					contentType: contentType || "text/plain",
				};
			}

			// Update browser history if requested
			if (updateHistory) {
				// Push state to history so back button works
				window.history.pushState(
					pageState,
					"",
					`#${ipfsUrl.replace("ipfs://", "/ipfs/")}`,
				);
			} else if (window.history.state === null) {
				// Replace state if we're just initializing from URL
				window.history.replaceState(
					pageState,
					"",
					`#${ipfsUrl.replace("ipfs://", "/ipfs/")}`,
				);
			}
		} catch (parseError) {
			console.error("Error parsing content:", parseError);

			// If not JSON, display as text
			const text = await response.text();

			const container = document.createElement("div");
			container.id = "content-container";

			const preElement = document.createElement("pre");
			preElement.textContent = escapeHtml(text);

			container.appendChild(preElement);

			document.body.innerHTML = "";
			document.body.appendChild(container);

			// Store the generated content
			pageContent = document.body.innerHTML;

			// Store page state
			pageState = {
				ipfsUrl,
				content: pageContent,
				contentType: "text/plain",
			};

			// Update browser history if requested
			if (updateHistory) {
				window.history.pushState(
					pageState,
					"",
					`#${ipfsUrl.replace("ipfs://", "/ipfs/")}`,
				);
			}
		}
	} catch (error) {
		console.error("Error fetching IPFS content:", {
			errorMsg: error instanceof Error ? error.message : String(error),
			url: ipfsUrl,
			stack: error instanceof Error ? error.stack : "No stack trace",
		});

		const container = document.createElement("div");
		container.id = "error-container";

		const errorMsg = document.createElement("pre");
		errorMsg.style.color = "red";
		errorMsg.textContent = `Error fetching IPFS content: ${error instanceof Error ? error.message : String(error)}`;

		container.appendChild(errorMsg);

		// Add a back button when there's an error
		const backButton = document.createElement("button");
		backButton.textContent = "Go Back";
		backButton.style.margin = "10px 0";
		backButton.style.padding = "5px 10px";
		backButton.onclick = () => window.history.back();

		container.appendChild(backButton);

		// Add a home button
		const homeButton = document.createElement("button");
		homeButton.textContent = "Go to Home";
		homeButton.style.margin = "10px 0 10px 10px";
		homeButton.style.padding = "5px 10px";
		homeButton.onclick = async () => {
			window.history.pushState(null, "", window.location.pathname);
			await loadInitialContent();
		};

		container.appendChild(homeButton);

		document.body.innerHTML = "";
		document.body.appendChild(container);
	}
}

// Make the routing function globally available for onclick handlers
declare global {
	interface Window {
		fetchAndDisplayIpfsContent: typeof fetchAndDisplayIpfsContent;
		routeToIpfsContent: typeof routeToIpfsContent;
	}
}
window.fetchAndDisplayIpfsContent = fetchAndDisplayIpfsContent;
window.routeToIpfsContent = routeToIpfsContent;

// Legacy function kept for compatibility, redirects to the router
async function fetchAndDisplayIpfsContent(ipfsUrl: string) {
	await loadIpfsContent(ipfsUrl, true);
}

runDemo();
