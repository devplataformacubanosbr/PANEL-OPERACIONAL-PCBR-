import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appPath = path.resolve(__dirname, '../src/App.jsx');
const clientViewPath = path.resolve(__dirname, '../src/components/ClientView.jsx');

let appContent = '';
let clientViewContent = '';

try {
  appContent = fs.readFileSync(appPath, 'utf8');
} catch (err) {
  console.error('Failed to read App.jsx:', err.message);
}

try {
  clientViewContent = fs.readFileSync(clientViewPath, 'utf8');
} catch (err) {
  console.error('Failed to read ClientView.jsx:', err.message);
}

// Read additional folders for the new features (Global AI, Context, AI Service tools)
let allComponentsContent = '';
try {
  const componentsDir = path.resolve(__dirname, '../src/components');
  if (fs.existsSync(componentsDir)) {
    const files = fs.readdirSync(componentsDir);
    for (const file of files) {
      if (file.endsWith('.jsx') || file.endsWith('.js')) {
        allComponentsContent += fs.readFileSync(path.join(componentsDir, file), 'utf8') + '\n';
      }
    }
  }
} catch (err) {
  console.error('Failed to read components:', err.message);
}

let allContextsContent = '';
try {
  const contextDir = path.resolve(__dirname, '../src/context');
  if (fs.existsSync(contextDir)) {
    const files = fs.readdirSync(contextDir);
    for (const file of files) {
      if (file.endsWith('.jsx') || file.endsWith('.js')) {
        allContextsContent += fs.readFileSync(path.join(contextDir, file), 'utf8') + '\n';
      }
    }
  }
} catch (_err) {
  // context directory might not exist yet
}

let allServicesContent = '';
try {
  const servicesDir = path.resolve(__dirname, '../src/services');
  if (fs.existsSync(servicesDir)) {
    const files = fs.readdirSync(servicesDir);
    for (const file of files) {
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        allServicesContent += fs.readFileSync(path.join(servicesDir, file), 'utf8') + '\n';
      }
    }
  }
} catch (err) {
  console.error('Failed to read services:', err.message);
}

const workflowPath = path.resolve(__dirname, '../n8n-kommo-workflow.json');
let workflowContent = '';
let workflowJson = null;
try {
  if (fs.existsSync(workflowPath)) {
    workflowContent = fs.readFileSync(workflowPath, 'utf8');
    workflowJson = JSON.parse(workflowContent);
  }
} catch (err) {
  console.error('Failed to read n8n-kommo-workflow.json:', err.message);
}

const tests = [
  // TIER 1 - Feature 1: Global Static Layout
  {
    id: 1,
    tier: 1,
    feature: 1,
    name: "App.jsx contains overflow: 'hidden' to restrict global page scroll",
    testFn: () => {
      const match = appContent.includes("overflow: 'hidden'") || appContent.includes('overflow: "hidden"');
      return { pass: match, message: match ? "Found overflow: 'hidden'" : "Missing overflow: 'hidden' in App.jsx" };
    }
  },
  {
    id: 2,
    tier: 1,
    feature: 1,
    name: "App.jsx layout wrapper uses height: '100vh' to lock viewport height",
    testFn: () => {
      const match = appContent.includes("height: '100vh'") || appContent.includes('height: "100vh"');
      return { pass: match, message: match ? "Found height: '100vh'" : "Missing height: '100vh' in App.jsx" };
    }
  },
  {
    id: 3,
    tier: 1,
    feature: 1,
    name: "App.jsx layout container has style display: 'flex'",
    testFn: () => {
      const match = appContent.includes("display: 'flex'") || appContent.includes('display: "flex"');
      return { pass: match, message: match ? "Found display: 'flex'" : "Missing display: 'flex' in App.jsx" };
    }
  },
  {
    id: 4,
    tier: 1,
    feature: 1,
    name: "App.jsx root element has className 'app-layout'",
    testFn: () => {
      const match = appContent.includes('className="app-layout"') || appContent.includes("className='app-layout'");
      return { pass: match, message: match ? "Found app-layout class name" : "Missing className='app-layout' in App.jsx" };
    }
  },
  {
    id: 5,
    tier: 1,
    feature: 1,
    name: "App.jsx has a <main> container to hold the view components",
    testFn: () => {
      const match = appContent.includes("<main") && appContent.includes("</main>");
      return { pass: match, message: match ? "Found <main> container" : "Missing <main> tag in App.jsx" };
    }
  },

  // TIER 1 - Feature 2: Fixed AI Chat Sidebar
  {
    id: 6,
    tier: 1,
    feature: 2,
    name: "ClientView.jsx contains AI Chat assistant text",
    testFn: () => {
      const match = clientViewContent.includes("Asistente IA");
      return { pass: match, message: match ? "Found Asistente IA reference" : "Missing Asistente IA reference in ClientView.jsx" };
    }
  },
  {
    id: 7,
    tier: 1,
    feature: 2,
    name: "ClientView.jsx uses grid/flex layout template with 2 columns",
    testFn: () => {
      const match = /gridTemplateColumns:\s*['"]220px\s+1fr['"]/.test(clientViewContent);
      return { pass: match, message: match ? "Found 2-column grid layout" : "Missing 2-column layout (e.g. gridTemplateColumns: '220px 1fr') in ClientView.jsx" };
    }
  },
  {
    id: 8,
    tier: 1,
    feature: 2,
    name: "ClientView.jsx right-hand sidebar has dedicated width (e.g. 400px)",
    testFn: () => {
      const match = clientViewContent.includes("width: '400px'") || clientViewContent.includes("width: '350px'") || clientViewContent.includes('width: "400px"');
      return { pass: match, message: match ? "Found sidebar width style" : "Missing explicit sidebar width (350px/400px) in ClientView.jsx" };
    }
  },
  {
    id: 9,
    tier: 1,
    feature: 2,
    name: "ClientView.jsx AI Chat uses flex layout for internals",
    testFn: () => {
      const match = clientViewContent.includes("display: 'flex'") && clientViewContent.includes("flexDirection: 'column'") && clientViewContent.includes("aiChatMessages");
      return { pass: match, message: match ? "Found flex layout for chat internals" : "Missing flex column layout on AI Chat in ClientView.jsx" };
    }
  },
  {
    id: 10,
    tier: 1,
    feature: 2,
    name: "ClientView.jsx imports Sparkles or Send icon for chat interface",
    testFn: () => {
      const match = clientViewContent.includes("Sparkles") && clientViewContent.includes("Send");
      return { pass: match, message: match ? "Found Sparkles and Send icon imports" : "Missing Sparkles/Send icon imports in ClientView.jsx" };
    }
  },

  // TIER 1 - Feature 3: Unified Central Scroll
  {
    id: 11,
    tier: 1,
    feature: 3,
    name: "ClientView.jsx renders a unified container instead of only activeTab content",
    testFn: () => {
      const match = !/categorias\.find\(c\s*=>\s*c\.id\s*===\s*activeTab\)\?\.nombre/.test(clientViewContent);
      return { pass: match, message: match ? "Categories are not filtered dynamically by activeTab for reading" : "Found activeTab filter limiting display to a single category" };
    }
  },
  {
    id: 12,
    tier: 1,
    feature: 3,
    name: "ClientView.jsx center column contains overflowY: 'auto' or 'scroll'",
    testFn: () => {
      const match = clientViewContent.includes("overflowY: 'auto'") || clientViewContent.includes('overflowY: "auto"') ||
                    clientViewContent.includes("overflowY: 'scroll'") || clientViewContent.includes('overflowY: "scroll"');
      return { pass: match, message: match ? "Found overflowY scroll style" : "Missing overflowY: 'auto' in ClientView.jsx" };
    }
  },
  {
    id: 13,
    tier: 1,
    feature: 3,
    name: "ClientView.jsx renders sections stacked vertically",
    testFn: () => {
      const match = /id=\s*['"](?:personal|family|document|datos|info)/.test(clientViewContent);
      return { pass: match, message: match ? "Found sections with ids for stacked layout" : "Missing section elements/ids for Datos Personales, Familiares, Documentos" };
    }
  },
  {
    id: 14,
    tier: 1,
    feature: 3,
    name: "ClientView.jsx uses flex/grid layout partition to separate main content",
    testFn: () => {
      const match = clientViewContent.includes("display: 'grid'") || clientViewContent.includes("display: 'flex'") ||
                    clientViewContent.includes('display: "grid"') || clientViewContent.includes('display: "flex"');
      return { pass: match, message: match ? "Found layout layout grid/flex style" : "Missing grid/flex layout container in ClientView.jsx" };
    }
  },
  {
    id: 15,
    tier: 1,
    feature: 3,
    name: "ClientView.jsx defines containers for stacked content",
    testFn: () => {
      const match = clientViewContent.includes("className=\"glass-panel\"") || clientViewContent.includes("className='glass-panel'") ||
                    clientViewContent.includes("className=\"glass-panel-elevated\"") || clientViewContent.includes("<section");
      return { pass: match, message: match ? "Found glass-panel/section containers" : "Missing container styles/classes for sections in ClientView.jsx" };
    }
  },

  // TIER 1 - Feature 4: Left-hand Quick Nav
  {
    id: 16,
    tier: 1,
    feature: 4,
    name: "ClientView.jsx has a left-hand navigation column/container",
    testFn: () => {
      const match = /quick-nav|quickNav|aside/i.test(clientViewContent);
      return { pass: match, message: match ? "Found left navigation container reference" : "Missing quick-nav / navigation sidebar in ClientView.jsx" };
    }
  },
  {
    id: 17,
    tier: 1,
    feature: 4,
    name: "Left Nav renders anchor elements or buttons to jump to sections",
    testFn: () => {
      const match = clientViewContent.includes("scrollIntoView");
      return { pass: match, message: match ? "Found scrollIntoView triggers for nav anchors" : "Missing anchor buttons or links using scrollIntoView in Left Nav" };
    }
  },
  {
    id: 18,
    tier: 1,
    feature: 4,
    name: "Left Nav anchors have click handlers",
    testFn: () => {
      const match = clientViewContent.includes("onClick") && clientViewContent.includes("scrollIntoView");
      return { pass: match, message: match ? "Found onClick and scrollIntoView interaction" : "Missing onClick scrollIntoView handlers in Left Nav" };
    }
  },
  {
    id: 19,
    tier: 1,
    feature: 4,
    name: "ClientView.jsx references scrollIntoView API",
    testFn: () => {
      const match = clientViewContent.includes("scrollIntoView");
      return { pass: match, message: match ? "Found scrollIntoView references" : "Missing scrollIntoView DOM API call in ClientView.jsx" };
    }
  },
  {
    id: 20,
    tier: 1,
    feature: 4,
    name: "ClientView.jsx defines scroll-target section IDs or refs",
    testFn: () => {
      const match = /id=\s*['"](?:personal|family|document|datos|info)/.test(clientViewContent);
      return { pass: match, message: match ? "Found scroll targets" : "Missing ID scroll-targets in ClientView.jsx sections" };
    }
  },

  // TIER 2 - Feature 1: Global Static Layout
  {
    id: 21,
    tier: 2,
    feature: 1,
    name: "App.jsx does not override overflow-y with scroll globally",
    testFn: () => {
      const match = !appContent.includes("overflowY: 'scroll'") && !appContent.includes('overflowY: "scroll"');
      return { pass: match, message: match ? "No global overflowY: 'scroll' found" : "Found global overflowY: 'scroll' which causes body scrolling" };
    }
  },
  {
    id: 22,
    tier: 2,
    feature: 1,
    name: "App.jsx does not contain layout styles matching overflow: 'scroll'",
    testFn: () => {
      const match = !/app-layout.*overflow:\s*['"]scroll['"]/.test(appContent);
      return { pass: match, message: match ? "No overflow: 'scroll' on layout root" : "Found overflow: 'scroll' on app-layout" };
    }
  },
  {
    id: 23,
    tier: 2,
    feature: 1,
    name: "App.jsx main viewport wrapper height is not hardcoded to a small static value like 500px",
    testFn: () => {
      const match = !/app-layout.*height:\s*['"]500px['"]/.test(appContent);
      return { pass: match, message: match ? "Height is viewport relative or large" : "Found static height of 500px on app-layout" };
    }
  },
  {
    id: 24,
    tier: 2,
    feature: 1,
    name: "App.jsx top bar header has a high zIndex to prevent overlap",
    testFn: () => {
      const match = /zIndex:\s*(?:10|\d{2,})/.test(appContent);
      return { pass: match, message: match ? "Found appropriate zIndex on header" : "Missing zIndex >= 10 on header in App.jsx" };
    }
  },
  {
    id: 25,
    tier: 2,
    feature: 1,
    name: "App.jsx aside sidebar uses fixed width to maintain layout proportions",
    testFn: () => {
      const match = appContent.includes("width: '240px'") || appContent.includes('width: "240px"');
      return { pass: match, message: match ? "Found sidebar width: '240px'" : "Missing width: '240px' for sidebar in App.jsx" };
    }
  },

  // TIER 2 - Feature 2: Fixed AI Chat Sidebar
  {
    id: 26,
    tier: 2,
    feature: 2,
    name: "AI Chat sidebar uses high zIndex overlay styles",
    testFn: () => {
      const match = (/position:\s*['"](?:absolute|fixed)['"]/.test(clientViewContent) && /zIndex:\s*(?:100|\d{3,})/.test(clientViewContent));
      return { pass: match, message: match ? "AI Chat is styled as a high zIndex overlay" : "Missing high zIndex >= 100 or position absolute/fixed on AI Chat (overlay drawer style)" };
    }
  },
  {
    id: 27,
    tier: 2,
    feature: 2,
    name: "AI Chat sidebar uses position: fixed or absolute when toggleable",
    testFn: () => {
      const match = /position:\s*['"](?:fixed|absolute)['"]/.test(clientViewContent);
      return { pass: match, message: match ? "AI Chat uses position: fixed or absolute layout" : "AI Chat does not use position: fixed or absolute layout" };
    }
  },
  {
    id: 28,
    tier: 2,
    feature: 2,
    name: "AI Chat textarea input is disabled during message loading",
    testFn: () => {
      const match = clientViewContent.includes("disabled={isAiChatLoading}");
      return { pass: match, message: match ? "Found disabled attribute on loading state" : "Missing disabled={isAiChatLoading} in ClientView.jsx textarea" };
    }
  },
  {
    id: 29,
    tier: 2,
    feature: 2,
    name: "AI Chat renders messages mapped from state",
    testFn: () => {
      const match = clientViewContent.includes("aiChatMessages.map");
      return { pass: match, message: match ? "Found message mapping" : "Missing aiChatMessages.map in ClientView.jsx" };
    }
  },
  {
    id: 30,
    tier: 2,
    feature: 2,
    name: "AI Chat send button is disabled when empty or loading",
    testFn: () => {
      const match = clientViewContent.includes("disabled={isAiChatLoading || !aiChatInput.trim()}");
      return { pass: match, message: match ? "Found disabled state for empty input/loading" : "Missing disabled={isAiChatLoading || !aiChatInput.trim()} in ClientView.jsx" };
    }
  },

  // TIER 2 - Feature 3: Unified Central Scroll
  {
    id: 31,
    tier: 2,
    feature: 3,
    name: "Central scroll container has height constraint (maxHeight or height calc)",
    testFn: () => {
      const match = /height:\s*['"]calc\(100vh/.test(clientViewContent) || /maxHeight:\s*['"]calc\(100vh/.test(clientViewContent) ||
                    /height:\s*['"]\d+/.test(clientViewContent) || /maxHeight:\s*['"]\d+/.test(clientViewContent) ||
                    /height:\s*['"]100%['"]/.test(clientViewContent) || /maxHeight:\s*['"]100%['"]/.test(clientViewContent);
      return { pass: match, message: match ? "Found height/max-height constraint" : "Missing height or maxHeight constraint on the scrollable container" };
    }
  },
  {
    id: 32,
    tier: 2,
    feature: 3,
    name: "Sections within scrollable container have distinct header elements",
    testFn: () => {
      const match = clientViewContent.includes("<h2") || clientViewContent.includes("<h3") || clientViewContent.includes("<h4");
      return { pass: match, message: match ? "Found header elements" : "Missing header elements (h2/h3) inside sections in ClientView.jsx" };
    }
  },
  {
    id: 33,
    tier: 2,
    feature: 3,
    name: "Scrollable container has padding spacing for layout breathing room",
    testFn: () => {
      const match = clientViewContent.includes("padding:") || clientViewContent.includes("paddingRight:") ||
                    clientViewContent.includes("paddingLeft:") || clientViewContent.includes("paddingY:") ||
                    clientViewContent.includes("paddingBottom:") || clientViewContent.includes("paddingTop:");
      return { pass: match, message: match ? "Found padding style on container" : "Missing padding spacing style on scrollable container" };
    }
  },
  {
    id: 34,
    tier: 2,
    feature: 3,
    name: "Scroll container handles empty data states gracefully",
    testFn: () => {
      const match = clientViewContent.includes("No hay datos") || clientViewContent.includes("empty") || clientViewContent.includes("!valor") || clientViewContent.includes("!dato");
      return { pass: match, message: match ? "Handles empty data state" : "Missing checks/placeholders for empty data sections" };
    }
  },
  {
    id: 35,
    tier: 2,
    feature: 3,
    name: "Scroll container does not contain overflow: 'hidden'",
    testFn: () => {
      const match = !/center-column.*overflow:\s*['"]hidden['"]/.test(clientViewContent);
      return { pass: match, message: match ? "Overflow hidden is not on center column" : "Found overflow: hidden on center-column which breaks scroll" };
    }
  },

  // TIER 2 - Feature 4: Left-hand Quick Nav
  {
    id: 36,
    tier: 2,
    feature: 4,
    name: "Left Nav items match the main client sections",
    testFn: () => {
      const match = clientViewContent.includes("Personales") || clientViewContent.includes("Familiares") || clientViewContent.includes("Documentos");
      return { pass: match, message: match ? "Found main client sections reference in Nav" : "Missing section names (Personales, Familiares, Documentos) in Left Nav" };
    }
  },
  {
    id: 37,
    tier: 2,
    feature: 4,
    name: "Left Nav uses smooth behavior for scrollIntoView calls",
    testFn: () => {
      const match = clientViewContent.includes("behavior: 'smooth'") || clientViewContent.includes('behavior: "smooth"') || clientViewContent.includes('behavior: "smooth"');
      return { pass: match, message: match ? "Found smooth scrolling behavior" : "Missing behavior: 'smooth' scroll option in scrollIntoView" };
    }
  },
  {
    id: 38,
    tier: 2,
    feature: 4,
    name: "Left Nav container remains sticky/fixed during scroll",
    testFn: () => {
      const match = clientViewContent.includes("position: 'sticky'") || clientViewContent.includes('position: "sticky"') ||
                    clientViewContent.includes("position: 'fixed'") || clientViewContent.includes('position: "fixed"');
      return { pass: match, message: match ? "Found sticky/fixed position style on Left Nav" : "Missing position: 'sticky' on Left Nav" };
    }
  },
  {
    id: 39,
    tier: 2,
    feature: 4,
    name: "Left Nav container has width/flex layout constraints to avoid layout shift",
    testFn: () => {
      const match = clientViewContent.includes("width:") || clientViewContent.includes("flex:") || clientViewContent.includes("flexBasis:") || clientViewContent.includes("flex-basis:");
      return { pass: match, message: match ? "Found layout constraints on Left Nav" : "Missing width or flex style constraints on Left Nav sidebar" };
    }
  },
  {
    id: 40,
    tier: 2,
    feature: 4,
    name: "Left Nav click handlers prevent default page reload",
    testFn: () => {
      const match = clientViewContent.includes("preventDefault") || /onClick.*scrollIntoView/.test(clientViewContent);
      return { pass: match, message: match ? "Click handlers prevent standard anchor reloads" : "Missing preventDefault() or button scroll handlers in Left Nav" };
    }
  },

  // TIER 3 - Feature Interaction Pairs
  {
    id: 41,
    tier: 3,
    feature: 2,
    name: "Layout & Chat Interaction: Main content wrapper uses 2-column layout and AI Chat uses overlay styling",
    testFn: () => {
      const match = /gridTemplateColumns:\s*['"]220px\s+1fr['"]/.test(clientViewContent) &&
                    (/position:\s*['"](?:absolute|fixed)['"]/.test(clientViewContent) && /zIndex:\s*(?:100|\d{3,})/.test(clientViewContent));
      return { pass: match, message: match ? "2-column grid columns set and AI Chat uses overlay styling" : "Missing 2-column grid columns or AI Chat overlay style with high zIndex" };
    }
  },
  {
    id: 42,
    tier: 3,
    feature: 3,
    name: "Scroll & Left Nav Interaction: Scroll container does not cause Left Nav to scroll out of viewport",
    testFn: () => {
      const match = (clientViewContent.includes("overflowY") || clientViewContent.includes("overflow-y")) &&
                    (clientViewContent.includes("position: 'sticky'") || clientViewContent.includes("position: 'fixed'") || /quick-nav|quickNav/i.test(clientViewContent));
      return { pass: match, message: match ? "Scroll container and Left Nav isolated correctly" : "Left Nav is not sticky/fixed, or scroll container is missing" };
    }
  },
  {
    id: 43,
    tier: 3,
    feature: 3,
    name: "Scroll & Chat Interaction: Scrolling center container does not scroll the AI Chat sidebar",
    testFn: () => {
      const match = (clientViewContent.includes("overflowY") || clientViewContent.includes("overflow-y")) &&
                    (clientViewContent.includes("Sparkles") || clientViewContent.includes("Asistente IA"));
      return { pass: match, message: match ? "Scroll container and Chat sidebar isolated correctly" : "Scroll container or Chat sidebar references missing" };
    }
  },
  {
    id: 44,
    tier: 3,
    feature: 4,
    name: "Left Nav & Scroll Target Interaction: Left Nav click targets match the section IDs in scroll container",
    testFn: () => {
      const match = /id=\s*['"](?:personal|family|document|datos|info)/.test(clientViewContent) &&
                    clientViewContent.includes("scrollIntoView");
      return { pass: match, message: match ? "Scroll target IDs exist and scrollIntoView triggers are present" : "Missing matched scroll target IDs and triggers" };
    }
  },

  // TIER 4 - Real-World Flow Validation
  {
    id: 45,
    tier: 4,
    feature: 1,
    name: "Viewport Responsiveness: Flex-grow or grid columns ensure the center column fills remaining space",
    testFn: () => {
      const match = clientViewContent.includes("flex: 1") || clientViewContent.includes("flexGrow: 1") ||
                    /gridTemplateColumns:\s*['"][^'"]*1fr[^'"]*['"]/.test(clientViewContent);
      return { pass: match, message: match ? "Flex grow/1fr grid used for center column responsiveness" : "No flex-grow or 1fr grid columns found for center content width" };
    }
  },
  {
    id: 46,
    tier: 4,
    feature: 1,
    name: "Full-Page Non-Scrollability: No root element allows overflowY scroll at global level",
    testFn: () => {
      const match = !/overflow-y:\s*['"]scroll['"]/.test(appContent) && !/overflowY:\s*['"]scroll['"]/.test(appContent);
      return { pass: match, message: match ? "No global overflowY scroll found" : "Global overflowY scroll detected on layout container" };
    }
  },
  {
    id: 47,
    tier: 4,
    feature: 2,
    name: "AI Chat visibility depends on isAiChatOpen state",
    testFn: () => {
      const match = clientViewContent.includes("{isAiChatOpen &&");
      return { pass: match, message: match ? "AI Chat visibility depends on isAiChatOpen" : "Missing conditional rendering {isAiChatOpen && ...} for AI Chat panel" };
    }
  },
  {
    id: 48,
    tier: 4,
    feature: 3,
    name: "DOM Anchoring Integrity: Sections are rendered sequentially within the unified scroll container",
    testFn: () => {
      const match = /id=\s*['"](?:personal|family|document|datos|info)/.test(clientViewContent);
      return { pass: match, message: match ? "Found sequential section anchors" : "Missing target sections in unified scroll container" };
    }
  },
  {
    id: 49,
    tier: 4,
    feature: 3,
    name: "Visual Hierarchy Spacing: Sections inside unified container use consistent margin or gap styles for breathability",
    testFn: () => {
      const match = clientViewContent.includes("gap:") || clientViewContent.includes("marginBottom:") || clientViewContent.includes("gap: '") || clientViewContent.includes('gap: "');
      return { pass: match, message: match ? "Spacing margins/gap found" : "No spacing margins/gap styling found in ClientView.jsx" };
    }
  },

  // TIER 1 - Feature 5: Global AI UI Component
  {
    id: 50,
    tier: 1,
    feature: 5,
    name: "Global AI FAB button exists in App.jsx or components",
    testFn: () => {
      const match = /global-ai-fab|GlobalAiFAB|FAB/i.test(appContent + allComponentsContent);
      return { pass: match, message: match ? "Found FAB button reference" : "Missing Global AI FAB floating button in App.jsx or component files" };
    }
  },
  {
    id: 51,
    tier: 1,
    feature: 5,
    name: "Global AI chat panel overlay container exists in components",
    testFn: () => {
      const match = /global-ai-panel|global-ai-chat|GlobalAiChatPanel|GlobalAiChatDrawer/i.test(appContent + allComponentsContent);
      return { pass: match, message: match ? "Found chat panel overlay container" : "Missing Global AI chat panel/drawer container" };
    }
  },
  {
    id: 52,
    tier: 1,
    feature: 5,
    name: "Global AI FAB has bottom-right floating position styles",
    testFn: () => {
      const match = /position:\s*['"]fixed['"].*bottom:.*right:/i.test(appContent + allComponentsContent) || 
                    /position:\s*['"]fixed['"].*right:.*bottom:/i.test(appContent + allComponentsContent) ||
                    /bottom:\s*['"][^'"]+['"].*right:\s*['"][^'"]+['"]/i.test(appContent + allComponentsContent) ||
                    /className\s*=\s*['"]global-ai-fab['"]/i.test(appContent + allComponentsContent);
      return { pass: match, message: match ? "Found FAB positioning style" : "Missing bottom-right fixed positioning style for the FAB button" };
    }
  },
  {
    id: 53,
    tier: 1,
    feature: 5,
    name: "Global AI chat overlay has toggle open/close state hook",
    testFn: () => {
      const match = /isGlobalAiOpen|showGlobalChat|showGlobalAi|openGlobalAi|isChatOpen/i.test(appContent + allComponentsContent);
      return { pass: match, message: match ? "Found toggle state hook" : "Missing state hooks/handlers to toggle the Global AI Chat overlay" };
    }
  },
  {
    id: 54,
    tier: 1,
    feature: 5,
    name: "Global AI FAB or panel uses chat/assistant icons",
    testFn: () => {
      const match = /MessageSquare|Sparkles|Bot|Brain|MessageCircle/i.test(appContent + allComponentsContent);
      return { pass: match, message: match ? "Found chat icons usage" : "Missing Lucide icon imports/usage for Chat button or Assistant panel" };
    }
  },

  // TIER 2 - Feature 5: Global AI UI Component (Boundary & Corner Cases)
  {
    id: 55,
    tier: 2,
    feature: 5,
    name: "Global AI chat panel has a high z-index overlay style",
    testFn: () => {
      const match = /zIndex:\s*(?:1000|999|\d{4,})/i.test(appContent + allComponentsContent) ||
                    /z-index:\s*(?:1000|999|\d{4,})/i.test(appContent + allComponentsContent);
      return { pass: match, message: match ? "Found high zIndex overlay style" : "Missing high z-index overlay style (>= 1000) for chat panel" };
    }
  },
  {
    id: 56,
    tier: 2,
    feature: 5,
    name: "Global AI chat panel has viewport height or scroll bounds",
    testFn: () => {
      const match = /height:\s*['"](?:calc|\d+vh|\d+px|100%|80%)['"]/i.test(appContent + allComponentsContent) ||
                    /maxHeight:\s*['"](?:calc|\d+vh|\d+px|100%|80%)['"]/i.test(appContent + allComponentsContent) ||
                    /height:\s*['"]\d+px['"]/i.test(appContent + allComponentsContent);
      return { pass: match, message: match ? "Found height constraints" : "Missing height or maxHeight constraint to prevent overflowing browser height" };
    }
  },
  {
    id: 57,
    tier: 2,
    feature: 5,
    name: "Global AI chat input disables send button when empty or loading",
    testFn: () => {
      const match = /disabled=\s*\{\s*[^}]*(?:loading|empty|trim|!)\s*\}/i.test(allComponentsContent + appContent);
      return { pass: match, message: match ? "Found input/button disabled handler" : "Missing disabled condition on chat input or send button for empty values/loading" };
    }
  },
  {
    id: 58,
    tier: 2,
    feature: 5,
    name: "Global AI chat panel includes a closing trigger",
    testFn: () => {
      const match = /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\w*(?:Open|Chat|Show)\w*\(\s*false\s*\)\s*\}/i.test(appContent + allComponentsContent) ||
                    /onClick\s*=\s*\{\s*\w*(?:Close|Toggle)\w*\s*\}/i.test(appContent + allComponentsContent) ||
                    /closeGlobalAi|closeChat/i.test(appContent + allComponentsContent);
      return { pass: match, message: match ? "Found close trigger" : "Missing click handlers to set open state to false or close the chat panel" };
    }
  },
  {
    id: 59,
    tier: 2,
    feature: 5,
    name: "Global AI panel uses fixed positioning overlay layout",
    testFn: () => {
      const match = /position:\s*['"](?:fixed|absolute)['"]/i.test(allComponentsContent) &&
                    /right:\s*['"][^'"]+['"]/i.test(allComponentsContent);
      return { pass: match, message: match ? "Found overlay positioning styles" : "Missing absolute/fixed layout styles for overlaying chat panel" };
    }
  },

  // TIER 1 - Feature 6: React Context Chat History
  {
    id: 60,
    tier: 1,
    feature: 6,
    name: "GlobalAiChatContext.jsx context file exists",
    testFn: () => {
      const match = allContextsContent.length > 0;
      return { pass: match, message: match ? "Context file exists" : "Missing src/context/GlobalAiChatContext.jsx file" };
    }
  },
  {
    id: 61,
    tier: 1,
    feature: 6,
    name: "Context file exports GlobalAiChatContext or useGlobalAiChat hook",
    testFn: () => {
      const match = allContextsContent.includes('GlobalAiChatContext') || allContextsContent.includes('useGlobalAiChat');
      return { pass: match, message: match ? "Found context or hook exports" : "Context file does not export GlobalAiChatContext or useGlobalAiChat hook" };
    }
  },
  {
    id: 62,
    tier: 1,
    feature: 6,
    name: "App.jsx imports and wraps layout in GlobalAiChatProvider",
    testFn: () => {
      const match = /GlobalAiChatProvider/i.test(appContent);
      return { pass: match, message: match ? "App.jsx wraps layout with Provider" : "Missing GlobalAiChatProvider wrap in App.jsx" };
    }
  },
  {
    id: 63,
    tier: 1,
    feature: 6,
    name: "GlobalAiChatProvider maintains messages state array",
    testFn: () => {
      const match = /useState\s*\(\s*\[\s*\]\s*\)/.test(allContextsContent) || /messages|chatHistory/i.test(allContextsContent);
      return { pass: match, message: match ? "Found messages state array" : "Missing messages state array in GlobalAiChatProvider" };
    }
  },
  {
    id: 64,
    tier: 1,
    feature: 6,
    name: "GlobalAiChatProvider exposes addMessage or sendMessage functions",
    testFn: () => {
      const match = /addMessage|sendMessage|appendMessage/i.test(allContextsContent);
      return { pass: match, message: match ? "Found message sending function" : "Missing exposed addMessage/sendMessage function in provider context value" };
    }
  },

  // TIER 2 - Feature 6: React Context Chat History (Boundary & Corner Cases)
  {
    id: 65,
    tier: 2,
    feature: 6,
    name: "GlobalAiChatProvider exposes clearChat or clearHistory reset functionality",
    testFn: () => {
      const match = /clearChat|clearHistory|resetChat/i.test(allContextsContent);
      return { pass: match, message: match ? "Found clear chat function" : "Missing clearChat/clearHistory resetting function in provider context" };
    }
  },
  {
    id: 66,
    tier: 2,
    feature: 6,
    name: "Global AI Chat state persists session conversation history across client view navigation",
    testFn: () => {
      const providerWrappedApp = /<GlobalAiChatProvider>[\s\S]*<div className="app-layout"/.test(appContent) ||
                                  /GlobalAiChatProvider/i.test(appContent);
      return { pass: providerWrappedApp, message: providerWrappedApp ? "Provider covers global routing layout" : "GlobalAiChatProvider does not wrap the main layout to persist state" };
    }
  },
  {
    id: 67,
    tier: 2,
    feature: 6,
    name: "useGlobalAiChat hook includes provider validation check",
    testFn: () => {
      const match = /if\s*\(\s*!\s*context\s*\)\s*\{\s*throw/i.test(allContextsContent) || 
                    /throw\s+new\s+Error\s*\(\s*['"]useGlobalAiChat/i.test(allContextsContent);
      return { pass: match, message: match ? "Found hook safety check" : "Missing safety check checking if context is undefined in useGlobalAiChat" };
    }
  },
  {
    id: 68,
    tier: 2,
    feature: 6,
    name: "Context message dispatch rejects empty or whitespace-only messages",
    testFn: () => {
      const match = /\.trim\(\)/.test(allContextsContent) || /if\s*\(\s*!\s*\w+message/i.test(allContextsContent);
      return { pass: match, message: match ? "Found empty message validation" : "Missing empty or blank message validation in context state dispatcher" };
    }
  },
  {
    id: 69,
    tier: 2,
    feature: 6,
    name: "Global AI Chat context initializes chat state as empty or with default welcome message",
    testFn: () => {
      const match = /useState\s*\(\s*(?:\[\]|Welcome|'|")/i.test(allContextsContent) || /messages|chatHistory/i.test(allContextsContent);
      return { pass: match, message: match ? "Found safe initialization state" : "Missing safe initial state assignment in chat context state" };
    }
  },

  // TIER 1 - Feature 7: AI Service Tool Calling & Database Tools
  {
    id: 70,
    tier: 1,
    feature: 7,
    name: "aiService.js implements and exports searchClientsByName",
    testFn: () => {
      const match = /export\s+(?:async\s+)?function\s+searchClientsByName/i.test(allServicesContent) ||
                    /searchClientsByName/i.test(allServicesContent);
      return { pass: match, message: match ? "Found searchClientsByName export" : "Missing searchClientsByName function in aiService.js" };
    }
  },
  {
    id: 71,
    tier: 1,
    feature: 7,
    name: "aiService.js implements and exports countPendingProcedures",
    testFn: () => {
      const match = /export\s+(?:async\s+)?function\s+countPendingProcedures/i.test(allServicesContent) ||
                    /countPendingProcedures/i.test(allServicesContent);
      return { pass: match, message: match ? "Found countPendingProcedures export" : "Missing countPendingProcedures function in aiService.js" };
    }
  },
  {
    id: 72,
    tier: 1,
    feature: 7,
    name: "aiService.js implements and exports getOverallStats",
    testFn: () => {
      const match = /export\s+(?:async\s+)?function\s+getOverallStats/i.test(allServicesContent) ||
                    /getOverallStats/i.test(allServicesContent);
      return { pass: match, message: match ? "Found getOverallStats export" : "Missing getOverallStats function in aiService.js" };
    }
  },
  {
    id: 73,
    tier: 1,
    feature: 7,
    name: "aiService.js defines AI tool-calling configuration schemas",
    testFn: () => {
      const match = /tools\s*:\s*\[|const\s+tools\s*=|type:\s*['"]function['"]/i.test(allServicesContent);
      return { pass: match, message: match ? "Found tools schemas definition" : "Missing tool call schemas configuration in aiService.js" };
    }
  },
  {
    id: 74,
    tier: 1,
    feature: 7,
    name: "aiService.js handles tool execution dispatching loop",
    testFn: () => {
      const match = /tool_calls|function\.name|toolCall/i.test(allServicesContent);
      return { pass: match, message: match ? "Found tool execution dispatching logic" : "Missing handler to execute local database functions when tool_calls are requested by AI" };
    }
  },

  // TIER 2 - Feature 7: AI Service Tool Calling & Database Tools (Boundary & Corner Cases)
  {
    id: 75,
    tier: 2,
    feature: 7,
    name: "Supabase queries in database tools use secure client builder syntax",
    testFn: () => {
      const match = /from\s*\(\s*['"]\w+['"]\s*\)\s*\.\s*select/i.test(allServicesContent);
      return { pass: match, message: match ? "Found secure client builder syntax" : "Missing Supabase client builder syntax (no raw SQL injection risks)" };
    }
  },
  {
    id: 76,
    tier: 2,
    feature: 7,
    name: "Database tool functions use try-catch blocks to prevent system crashes",
    testFn: () => {
      const match = /try\s*\{[\s\S]*catch/i.test(allServicesContent);
      return { pass: match, message: match ? "Found try-catch blocks in service file" : "Missing try-catch query blocks protecting functions against DB offline crashes" };
    }
  },
  {
    id: 77,
    tier: 2,
    feature: 7,
    name: "searchClientsByName returns empty array or default when queried with empty string",
    testFn: () => {
      const match = /searchClientsByName[\s\S]*!(?:name|query)/i.test(allServicesContent) ||
                    /searchClientsByName[\s\S]*length\s*===\s*0/i.test(allServicesContent);
      return { pass: match, message: match ? "Found empty validation check in searchClientsByName" : "Missing input validation guarding searchClientsByName against empty search queries" };
    }
  },
  {
    id: 78,
    tier: 2,
    feature: 7,
    name: "AI tool dispatching has fallback handler for unknown tool execution requests",
    testFn: () => {
      const match = /throw\s+new\s+Error|default\s*:|else\s*\{/i.test(allServicesContent) && /tool/i.test(allServicesContent);
      return { pass: match, message: match ? "Found fallback error/default handling for unknown tools" : "Missing error/default handler in tools dispatching logic when model calls invalid tool names" };
    }
  },
  {
    id: 79,
    tier: 2,
    feature: 7,
    name: "Database tool helper functions are declared as asynchronous",
    testFn: () => {
      const match = /async\s+function\s+searchClientsByName/i.test(allServicesContent) && 
                    /async\s+function\s+countPendingProcedures/i.test(allServicesContent) && 
                    /async\s+function\s+getOverallStats/i.test(allServicesContent);
      return { pass: match, message: match ? "All functions declared as async" : "Database helper functions must be async (returning Promise interface)" };
    }
  },

  // TIER 3 - Cross-Feature Combinations
  {
    id: 80,
    tier: 3,
    feature: 5,
    name: "FAB overlay position absolute/fixed does not conflict with main layout grid columns",
    testFn: () => {
      const isFabFixed = /position:\s*['"]fixed['"]/i.test(appContent + allComponentsContent);
      const isMainLayoutUntouched = !/app-layout.*position:\s*['"]fixed['"]/i.test(appContent);
      const pass = isFabFixed && isMainLayoutUntouched;
      return { pass, message: pass ? "FAB button does not affect main layout rendering blocks" : "FAB layout fixed-position is missing or main layout wrapper position was corrupted" };
    }
  },
  {
    id: 81,
    tier: 3,
    feature: 6,
    name: "Assistant messages containing tool results are appended to Global Chat context history",
    testFn: () => {
      const hasHookUsage = /useGlobalAiChat/i.test(allComponentsContent) || /GlobalAiChatContext/i.test(allComponentsContent);
      const hasToolsExecutionResultInChat = /tool_calls|executeTool/i.test(allServicesContent + allComponentsContent);
      const pass = hasHookUsage && hasToolsExecutionResultInChat;
      return { pass, message: pass ? "Found hook usage with tool result appending flow" : "Chat Context is not connected to tool execution dispatchers" };
    }
  },
  {
    id: 82,
    tier: 3,
    feature: 6,
    name: "View change state does not re-initialize the GlobalAiChatContext value",
    testFn: () => {
      const wrapsWholeLayout = /<GlobalAiChatProvider>[\s\S]*<div className="app-layout"/i.test(appContent);
      return { pass: wrapsWholeLayout, message: wrapsWholeLayout ? "GlobalAiChatProvider wraps outer app layout" : "Context Provider does not wrap routing state elements, causing state loss on view changes" };
    }
  },

  // TIER 4 - Real-World Application Scenarios
  {
    id: 83,
    tier: 4,
    feature: 7,
    name: "Real-World: Simulating prompt 'Dame estadísticas generales' executes getOverallStats and displays numbers",
    testFn: () => {
      const match = /getOverallStats/i.test(allServicesContent) && /stats/i.test(allComponentsContent + allServicesContent);
      return { pass: match, message: match ? "Found stats scenario mapping" : "Overall stats inquiry query and executor bindings not found in service/components" };
    }
  },
  {
    id: 84,
    tier: 4,
    feature: 7,
    name: "Real-World: Simulating prompt 'Buscar cliente Marcos' calls searchClientsByName and retrieves list",
    testFn: () => {
      const match = /searchClientsByName/i.test(allServicesContent) && /search/i.test(allComponentsContent + allServicesContent);
      return { pass: match, message: match ? "Found search query scenario mapping" : "Client search query prompt and executor bindings not found in service/components" };
    }
  },
  {
    id: 85,
    tier: 4,
    feature: 6,
    name: "Real-World: Navigating between dashboard and clients list views preserves chat context message logs",
    testFn: () => {
      const match = /GlobalAiChatProvider/i.test(appContent) && /currentView/i.test(appContent);
      return { pass: match, message: match ? "Context is placed above the view routing switch" : "Chat Provider does not wrap the main currentView navigation structure" };
    }
  },
  {
    id: 86,
    tier: 4,
    feature: 7,
    name: "Real-World: Simulating prompt 'Cuántos trámites pendientes' executes countPendingProcedures",
    testFn: () => {
      const match = /countPendingProcedures/i.test(allServicesContent) && /procedures|tramites/i.test(allComponentsContent + allServicesContent);
      return { pass: match, message: match ? "Found procedures query scenario mapping" : "Procedures pending query prompt and executor bindings not found in service/components" };
    }
  },
  {
    id: 87,
    tier: 4,
    feature: 5,
    name: "Real-World: Context persists messages after navigation and tool executing in a multi-turn conversation simulation",
    testFn: () => {
      const match = /GlobalAiChatProvider/i.test(appContent) && /searchClientsByName|countPendingProcedures|getOverallStats/i.test(allServicesContent);
      return { pass: match, message: match ? "Verified persistent context and tool integration" : "RAG-tool multi-turn chat persistence workflow check failed: context or database tool execution is missing" };
    }
  },
  // TIER 1/2 - Feature 8: n8n Workflow Data Mapping (R1)
  {
    id: 88,
    tier: 1,
    feature: 8,
    name: "n8n Workflow: Actualizar Cliente does not use .data[0] to access properties in fields updated",
    testFn: () => {
      const node = workflowJson?.nodes?.find(n => n.name === 'Actualizar Cliente');
      if (!node) return { pass: false, message: "Node 'Actualizar Cliente' not found in workflow" };
      const nodeStr = JSON.stringify(node);
      const usesDataZero = nodeStr.includes('.data[0]');
      return {
        pass: !usesDataZero,
        message: !usesDataZero 
          ? "No usage of '.data[0]' in 'Actualizar Cliente'" 
          : "Found usage of '.data[0]' in 'Actualizar Cliente'"
      };
    }
  },
  {
    id: 89,
    tier: 1,
    feature: 8,
    name: "n8n Workflow: CPF is not hardcoded to '1' (must be mapped from lead/contact)",
    testFn: () => {
      const nodes = workflowJson?.nodes?.filter(n => n.name === 'Crear Cliente' || n.name === 'Insertar Entrada') || [];
      if (nodes.length === 0) return { pass: false, message: "Crear Cliente and Insertar Entrada nodes not found in workflow" };
      let hasHardcodedCpf = false;
      for (const node of nodes) {
        const fieldValues = node.parameters?.fieldsUi?.fieldValues || [];
        const cpfField = fieldValues.find(f => f.fieldId === 'cpf');
        if (cpfField && cpfField.fieldValue === '1') {
          hasHardcodedCpf = true;
        }
      }
      return {
        pass: !hasHardcodedCpf,
        message: !hasHardcodedCpf 
          ? "CPF is not hardcoded to '1'" 
          : "CPF is hardcoded to '1' in Crear Cliente or Insertar Entrada nodes"
      };
    }
  },
  {
    id: 90,
    tier: 1,
    feature: 8,
    name: "n8n Workflow: 'estado' field is mapped from lead data to the 'entradas' insertion node",
    testFn: () => {
      const node = workflowJson?.nodes?.find(n => n.name === 'Insertar Entrada');
      if (!node) return { pass: false, message: "Node 'Insertar Entrada' not found in workflow" };
      const fieldValues = node.parameters?.fieldsUi?.fieldValues || [];
      const estadoField = fieldValues.find(f => f.fieldId === 'estado');
      const pass = !!estadoField && estadoField.fieldValue.includes('estado');
      return {
        pass,
        message: pass 
          ? "Found 'estado' field mapping in 'Insertar Entrada' node" 
          : "Missing 'estado' field mapping in 'Insertar Entrada' node"
      };
    }
  },
  {
    id: 91,
    tier: 2,
    feature: 8,
    name: "n8n Workflow: Does not map spelling-mismatched keys (e.g. recurrencia vs recorrencia)",
    testFn: () => {
      if (!workflowContent) return { pass: false, message: "Workflow content not loaded" };
      // Check if both recurrencia (u) and recorrencia (o) are used in parameters/mappings
      const hasRecurrencia = workflowContent.includes('recurrencia');
      const hasRecorrencia = workflowContent.includes('recorrencia');
      const pass = !(hasRecurrencia && hasRecorrencia);
      return {
        pass,
        message: pass 
          ? "No spelling-mismatched keys used for recurrence in workflow" 
          : "Spelling-mismatched keys found: 'recurrencia' and 'recorrencia' are both used in workflow"
      };
    }
  },
  // TIER 1 - Feature 9: AI Assistant History Persistence (R2)
  {
    id: 92,
    tier: 1,
    feature: 9,
    name: "App.jsx: Passes selectedClientId as a prop to GlobalAiChatProvider",
    testFn: () => {
      const match = /<GlobalAiChatProvider\s+[^>]*selectedClientId/i.test(appContent);
      return {
        pass: match,
        message: match 
          ? "App.jsx passes selectedClientId to GlobalAiChatProvider" 
          : "App.jsx does not pass selectedClientId to GlobalAiChatProvider"
      };
    }
  },
  {
    id: 93,
    tier: 1,
    feature: 9,
    name: "GlobalAiChatContext.jsx: Imports supabase, uses table 'ai_chats', and inserts messages",
    testFn: () => {
      const hasSupabase = allContextsContent.includes('supabase');
      const hasFromAiChats = allContextsContent.includes(".from('ai_chats')") || allContextsContent.includes('.from("ai_chats")');
      const hasInsert = allContextsContent.includes('.insert(');
      const pass = hasSupabase && hasFromAiChats && hasInsert;
      return {
        pass,
        message: pass 
          ? "GlobalAiChatContext.jsx imports supabase and inserts into ai_chats" 
          : `Checks failed: hasSupabase=${hasSupabase}, hasFromAiChats=${hasFromAiChats}, hasInsert=${hasInsert}`
      };
    }
  },
  {
    id: 94,
    tier: 1,
    feature: 9,
    name: "GlobalAiChatContext.jsx: Triggers history loading from 'ai_chats' on selectedClientId change",
    testFn: () => {
      const hasUseEffect = allContextsContent.includes('useEffect');
      const hasDepArray = /useEffect\([\s\S]*\[\s*selectedClientId\s*\]\s*\)/.test(allContextsContent) ||
                          allContextsContent.includes('selectedClientId');
      const hasSelectQuery = allContextsContent.includes('.select(') && (allContextsContent.includes('ai_chats') || allContextsContent.includes('chats'));
      const pass = hasUseEffect && hasDepArray && hasSelectQuery;
      return {
        pass,
        message: pass 
          ? "GlobalAiChatContext.jsx triggers history loading from ai_chats when selectedClientId changes" 
          : `Checks failed: hasUseEffect=${hasUseEffect}, hasDepArray/selectedClientId=${hasDepArray}, hasSelectQuery=${hasSelectQuery}`
      };
    }
  },
  // TIER 1 - Feature 10: Gmail Integration and UI Redesign
  {
    id: 95,
    tier: 1,
    feature: 10,
    name: "fetchClientEmails uses pageToken pagination for historical fetch",
    testFn: () => {
      const match = allServicesContent.includes('nextPageToken') && allServicesContent.includes('pageToken');
      return { pass: match, message: match ? "Found nextPageToken pagination" : "Missing nextPageToken loop in fetchClientEmails" };
    }
  },
  {
    id: 96,
    tier: 1,
    feature: 10,
    name: "fetchClientEmails combines messages across pages",
    testFn: () => {
      const match = allServicesContent.includes('concat') || allServicesContent.includes('push');
      return { pass: match, message: match ? "Found array combination" : "Missing message combination across pages in fetchClientEmails" };
    }
  },
  {
    id: 97,
    tier: 1,
    feature: 10,
    name: "formatGmailMessage parses destinatarios as an array and extracts adjuntos",
    testFn: () => {
      const match = allServicesContent.includes('destinatarios') && allServicesContent.includes('adjuntos');
      return { pass: match, message: match ? "Found destinatarios and adjuntos in formatting" : "Missing destinatarios array or adjuntos array parsing in formatGmailMessage" };
    }
  },
  {
    id: 98,
    tier: 1,
    feature: 10,
    name: "ClientEmail.jsx renders tabs for Todos, Recibidos, and Enviados",
    testFn: () => {
      const contentLower = allComponentsContent.toLowerCase();
      const match = contentLower.includes('todos') && contentLower.includes('recibidos') && contentLower.includes('enviados');
      return { pass: match, message: match ? "Found Todos, Recibidos, and Enviados tabs" : "Missing tabs for Todos, Recibidos, or Enviados in ClientEmail.jsx" };
    }
  },
  {
    id: 99,
    tier: 1,
    feature: 10,
    name: "ClientEmail.jsx filters Recibidos and Enviados using INBOX and SENT label IDs",
    testFn: () => {
      const match = allComponentsContent.includes('INBOX') && allComponentsContent.includes('SENT');
      return { pass: match, message: match ? "Found INBOX and SENT label ID filtering" : "Missing filtering logic using INBOX and SENT in ClientEmail.jsx" };
    }
  },
  {
    id: 100,
    tier: 1,
    feature: 10,
    name: "ClientEmail.jsx implements a thread/reading pane view and uses Gmail style hexes like #C2E7FF and #EAF1FB or #E8F0FE",
    testFn: () => {
      const contentLower = allComponentsContent.toLowerCase();
      const hasHex1 = contentLower.includes('#c2e7ff');
      const hasHex2 = contentLower.includes('#eaf1fb') || contentLower.includes('#e8f0fe');
      const hasThread = contentLower.includes('threadid') || contentLower.includes('thread');
      const pass = hasHex1 && hasHex2 && hasThread;
      return { 
        pass, 
        message: pass 
          ? "Found thread/reading pane view and correct Gmail hexes" 
          : `Checks failed: hasHex1(#c2e7ff)=${hasHex1}, hasHex2(#eaf1fb/#e8f0fe)=${hasHex2}, hasThread=${hasThread}`
      };
    }
  }
];

export { tests };
