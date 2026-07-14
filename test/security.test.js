const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../');
const operDir = path.resolve(rootDir, 'DASHBOARDOperacional');
const operSpacedDir = path.resolve(rootDir, 'DASHBOARD Operacional');
const finDir = path.resolve(rootDir, 'DASHBOARDFinanciero');

const setupSqlPath = path.resolve(finDir, 'supabase-setup.sql');
const clientListViewPath = path.resolve(operDir, 'src/components/ClientListView.jsx');
const appJsPath = path.resolve(finDir, 'app.js');
const utilsJsPath = path.resolve(finDir, 'utils.js');
const supabaseClientPath = path.resolve(operDir, 'src/supabaseClient.js');
const aiServicePath = path.resolve(operDir, 'src/services/aiService.js');
const workflowPath = path.resolve(operDir, 'n8n-kommo-workflow.json');

function getFilesRecursively(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFilesRecursively(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allOperationalFiles = getFilesRecursively(operDir);
const allSpacedOperationalFiles = getFilesRecursively(operSpacedDir);
const allFinancialFiles = getFilesRecursively(finDir);
const allCodeFiles = [...allOperationalFiles, ...allSpacedOperationalFiles, ...allFinancialFiles];

// Robust Environment files scanner (Root directory and all subprojects)
const envFiles = [];
const searchDirs = [rootDir, operDir, operSpacedDir, finDir];
for (const d of searchDirs) {
  if (fs.existsSync(d)) {
    const files = fs.readdirSync(d);
    for (const f of files) {
      if (f.startsWith('.env') && !f.endsWith('.env.example')) {
        envFiles.push(path.join(d, f));
      }
    }
  }
}

// Read files securely with fallback empty strings if they don't exist yet
let appContent = '';
let clientListContent = '';
let supabaseClientContent = '';
let aiServiceContent = '';
let workflowContent = '';
let sqlContent = '';
let appJsContent = '';
let utilsJsContent = '';

try { appContent = fs.readFileSync(path.resolve(operDir, 'src/App.jsx'), 'utf8'); } catch (_e) {}
try { clientListContent = fs.readFileSync(clientListViewPath, 'utf8'); } catch (_e) {}
try { supabaseClientContent = fs.readFileSync(supabaseClientPath, 'utf8'); } catch (_e) {}
try { aiServiceContent = fs.readFileSync(aiServicePath, 'utf8'); } catch (_e) {}
try { workflowContent = fs.readFileSync(workflowPath, 'utf8'); } catch (_e) {}
try { sqlContent = fs.readFileSync(setupSqlPath, 'utf8'); } catch (_e) {}
try { appJsContent = fs.readFileSync(appJsPath, 'utf8'); } catch (_e) {}
try { utilsJsContent = fs.readFileSync(utilsJsPath, 'utf8'); } catch (_e) {}

// Decode JWT to inspect role
function isServiceRoleJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    return payload.role === 'service_role';
  } catch (_e) {
    return false;
  }
}

const tests = [
  // ==================== REQUIREMENT R1: SECURE CREDENTIALS ====================
  {
    id: "R1-T1-1",
    tier: 1,
    category: "CREDENTIALS",
    name: "No active Supabase secret key in operational dashboard .env",
    testFn: () => {
      for (const p of envFiles) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf8');
          const match = content.match(/(?:VITE_)?SUPABASE_SECRET_KEY\s*=\s*(.+)/);
          if (match) {
            const val = match[1].trim();
            if (val && !val.includes('your_') && !val.includes('placeholder') && isServiceRoleJwt(val)) {
              return { pass: false, message: `Found active Supabase service_role JWT in ${p}` };
            }
          }
        }
      }
      return { pass: true, message: "No active Supabase secret/service_role keys found in .env files" };
    }
  },
  {
    id: "R1-T1-2",
    tier: 1,
    category: "CREDENTIALS",
    name: "Example env files contain only placeholder values",
    testFn: () => {
      const pathsToCheck = [
        path.join(operDir, '.env.example'),
        path.join(finDir, '.env.example')
      ];
      for (const p of pathsToCheck) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf8');
          const tokens = content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || [];
          for (const token of tokens) {
            if (isServiceRoleJwt(token)) {
              return { pass: false, message: `Found active service_role JWT inside example file: ${p}` };
            }
          }
        }
      }
      return { pass: true, message: "No active service_role JWT inside example env files" };
    }
  },
  {
    id: "R1-T1-3",
    tier: 1,
    category: "CREDENTIALS",
    name: "Source files do not reference VITE_SUPABASE_SECRET_KEY",
    testFn: () => {
      const forbiddenRef = 'VITE_SUPABASE_SECRET_KEY';
      for (const file of allCodeFiles) {
        if (file.endsWith('.js') || file.endsWith('.jsx')) {
          if (file.includes('supabaseClient.js') || file.includes('security.test.js') || file.includes('e2e.test.js') || file.includes('progress.md')) continue;
          const content = fs.readFileSync(file, 'utf8');
          if (content.includes(forbiddenRef)) {
            return { pass: false, message: `Exposed secret key reference found in ${file}` };
          }
        }
      }
      return { pass: true, message: "No source files reference VITE_SUPABASE_SECRET_KEY" };
    }
  },
  {
    id: "R1-T1-4",
    tier: 1,
    category: "CREDENTIALS",
    name: "Supabase Client uses only VITE_SUPABASE_ANON_KEY",
    testFn: () => {
      const clientPath = path.join(operDir, 'src/supabaseClient.js');
      if (!fs.existsSync(clientPath)) return { pass: false, message: "supabaseClient.js not found" };
      const content = fs.readFileSync(clientPath, 'utf8');
      const usesAnon = content.includes('VITE_SUPABASE_ANON_KEY');
      const usesSecret = content.includes('VITE_SUPABASE_SECRET_KEY');
      if (usesSecret) {
        return { pass: false, message: "supabaseClient.js still references VITE_SUPABASE_SECRET_KEY" };
      }
      return { pass: usesAnon, message: usesAnon ? "Client uses anon key" : "Client does not reference VITE_SUPABASE_ANON_KEY" };
    }
  },
  {
    id: "R1-T1-5",
    tier: 1,
    category: "CREDENTIALS",
    name: "Build output files do not leak service_role keys",
    testFn: () => {
      const distDir = path.join(operDir, 'dist');
      if (!fs.existsSync(distDir)) return { pass: true, message: "dist directory does not exist (pre-build)" };
      const distFiles = getFilesRecursively(distDir);
      for (const file of distFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const tokens = content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || [];
        for (const token of tokens) {
          if (isServiceRoleJwt(token)) {
            return { pass: false, message: `Leaked service_role key found inside build file: ${file}` };
          }
        }
      }
      return { pass: true, message: "No leaked credentials in dist files" };
    }
  },
  {
    id: "R1-T2-1",
    tier: 2,
    category: "CREDENTIALS",
    name: "Deep JWT Scan for service_role payload role values",
    testFn: () => {
      for (const file of allCodeFiles) {
        if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.html') || file.endsWith('.env')) {
          if (file.includes('security.test.js') || file.includes('e2e.test.js') || file.includes('progress.md') || file.includes('handoff.md')) continue;
          const content = fs.readFileSync(file, 'utf8');
          const tokens = content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || [];
          for (const token of tokens) {
            if (isServiceRoleJwt(token)) {
              return { pass: false, message: `Service role token detected in file: ${file}` };
            }
          }
        }
      }
      return { pass: true, message: "No service_role JWT payloads detected in any code or env files" };
    }
  },
  {
    id: "R1-T2-2",
    tier: 2,
    category: "CREDENTIALS",
    name: "Nested environment files scanner",
    testFn: () => {
      const nestedEnvFiles = envFiles.filter(f => {
        const dir = path.dirname(f);
        return dir !== rootDir && dir !== operDir && dir !== operSpacedDir && dir !== finDir;
      });
      if (nestedEnvFiles.length > 0) {
        return { pass: false, message: `Found forbidden nested env files: ${nestedEnvFiles.join(', ')}` };
      }
      return { pass: true, message: "No nested env files found" };
    }
  },
  {
    id: "R1-T2-3",
    tier: 2,
    category: "CREDENTIALS",
    name: "Detection of split string obfuscated service_role signatures",
    testFn: () => {
      const splitHeaderPattern = /['"`]eyJhbGci['"`]\s*\+\s*['"`]OiJIUzI1Ni['"`]/i;
      for (const file of allCodeFiles) {
        if (file.endsWith('.js') || file.endsWith('.jsx')) {
          if (file.includes('security.test.js') || file.includes('e2e.test.js') || file.includes('progress.md') || file.includes('handoff.md')) continue;
          const content = fs.readFileSync(file, 'utf8');
          if (splitHeaderPattern.test(content)) {
            return { pass: false, message: `Potential split-string JWT header obfuscation in ${file}` };
          }
        }
      }
      return { pass: true, message: "No obvious split JWT token obfuscation detected" };
    }
  },
  {
    id: "R1-T2-4",
    tier: 2,
    category: "CREDENTIALS",
    name: "Prefix constraints for Supabase variables",
    testFn: () => {
      for (const file of envFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('VITE_SUPABASE_SERVICE_ROLE_KEY') || content.includes('SUPABASE_ADMIN_KEY')) {
          return { pass: false, message: `Exposed high-privilege Supabase env variable name in: ${file}` };
        }
      }
      return { pass: true, message: "No forbidden Supabase high-privilege variables found" };
    }
  },
  {
    id: "R1-T2-5",
    tier: 2,
    category: "CREDENTIALS",
    name: "Client config templates check",
    testFn: () => {
      const configTplPath = path.join(finDir, 'config.template.js');
      if (!fs.existsSync(configTplPath)) return { pass: true, message: "config.template.js not present" };
      const content = fs.readFileSync(configTplPath, 'utf8');
      if (content.includes('SECRET') || content.includes('secret') || content.includes('service_role')) {
        return { pass: false, message: "config.template.js leaks secret references" };
      }
      return { pass: true, message: "config.template.js is clean" };
    }
  },

  // ==================== REQUIREMENT R2: AUTHENTICATION ====================
  {
    id: "R2-T1-1",
    tier: 1,
    category: "AUTH",
    name: "App.jsx defines session state",
    testFn: () => {
      const appPath = path.join(operDir, 'src/App.jsx');
      if (!fs.existsSync(appPath)) return { pass: false, message: "App.jsx not found" };
      const content = fs.readFileSync(appPath, 'utf8');
      const hasSessionState = content.includes('session') && content.includes('setSession');
      return { pass: hasSessionState, message: hasSessionState ? "Session state hook found" : "No session/setSession state hook in App.jsx" };
    }
  },
  {
    id: "R2-T1-2",
    tier: 1,
    category: "AUTH",
    name: "App.jsx subscribes to auth state changes",
    testFn: () => {
      const appPath = path.join(operDir, 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf8');
      const hasAuthListener = content.includes('onAuthStateChange');
      return { pass: hasAuthListener, message: hasAuthListener ? "onAuthStateChange hook listener found" : "Missing onAuthStateChange listener in App.jsx" };
    }
  },
  {
    id: "R2-T1-3",
    tier: 1,
    category: "AUTH",
    name: "App.jsx checks initial session on mount",
    testFn: () => {
      const appPath = path.join(operDir, 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf8');
      const hasGetSession = content.includes('getSession');
      return { pass: hasGetSession, message: hasGetSession ? "getSession call found" : "Missing getSession call on mount in App.jsx" };
    }
  },
  {
    id: "R2-T1-4",
    tier: 1,
    category: "AUTH",
    name: "App.jsx conditionally renders login panel when session is null",
    testFn: () => {
      const appPath = path.join(operDir, 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf8');
      const hasLoginRender = content.includes('Login') || content.includes('login') || content.includes('!session');
      const hasAppLayoutGuard = content.includes('session ?') || content.includes('!session ?') || content.includes('if (!session)');
      const pass = hasLoginRender && hasAppLayoutGuard;
      return { pass, message: pass ? "Auth guard rendering flow detected" : "App.jsx lacks logic guarding app-layout when session is absent" };
    }
  },
  {
    id: "R2-T1-5",
    tier: 1,
    category: "AUTH",
    name: "App.jsx or layouts provide sign-out trigger",
    testFn: () => {
      const appPath = path.join(operDir, 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf8');
      const hasSignOut = content.includes('signOut') && content.includes('supabase');
      return { pass: hasSignOut, message: hasSignOut ? "Sign out handler found" : "No signOut handler found in App.jsx" };
    }
  },
  {
    id: "R2-T2-1",
    tier: 2,
    category: "AUTH",
    name: "Login UI Form exposes email and password inputs",
    testFn: () => {
      const appPath = path.join(operDir, 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf8');
      const hasEmailInput = content.includes('type="email"') || content.includes("type='email'");
      const hasPasswordInput = content.includes('type="password"') || content.includes("type='password'");
      const hasSignIn = content.includes('signInWithPassword');
      const pass = hasEmailInput && hasPasswordInput && hasSignIn;
      return { pass, message: pass ? "Form inputs and signIn API verified" : `Inputs check failed: email=${hasEmailInput}, password=${hasPasswordInput}, signIn=${hasSignIn}` };
    }
  },
  {
    id: "R2-T2-2",
    tier: 2,
    category: "AUTH",
    name: "App.jsx implements loading screen protection",
    testFn: () => {
      const appPath = path.join(operDir, 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf8');
      const hasLoadingState = content.includes('loading') && content.includes('setLoading');
      return { pass: hasLoadingState, message: hasLoadingState ? "Loading screen hooks found" : "No loading spinner/state verification to prevent flickering" };
    }
  },
  {
    id: "R2-T2-3",
    tier: 2,
    category: "AUTH",
    name: "Clean up active auth subscription on unmount",
    testFn: () => {
      const appPath = path.join(operDir, 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf8');
      const hasCleanup = content.includes('unsubscribe') || content.includes('subscription.unsubscribe');
      return { pass: hasCleanup, message: hasCleanup ? "Auth listener clean up registered" : "Missing unsubscribe cleanup function in App.jsx useEffect" };
    }
  },
  {
    id: "R2-T2-4",
    tier: 2,
    category: "AUTH",
    name: "Error handling inside login form",
    testFn: () => {
      const appPath = path.join(operDir, 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf8');
      const hasErrorDisplay = content.includes('error.message') || content.includes('setError') || content.includes('errorMessage');
      return { pass: hasErrorDisplay, message: hasErrorDisplay ? "Login error handler implemented" : "No error hooks/alerts rendered for incorrect login attempts" };
    }
  },
  {
    id: "R2-T2-5",
    tier: 2,
    category: "AUTH",
    name: "Hash route guards for unauthenticated views",
    testFn: () => {
      const appPath = path.join(operDir, 'src/App.jsx');
      const content = fs.readFileSync(appPath, 'utf8');
      const guardsHash = content.includes('hashchange') && (content.includes('!session') || content.includes('session'));
      return { pass: guardsHash, message: guardsHash ? "Guarded hash navigation routes detected" : "Hash routing useEffect has no auth session checks" };
    }
  },

  // ==================== REQUIREMENT R3: ROW LEVEL SECURITY ====================
  {
    id: "R3-T1-1",
    tier: 1,
    category: "RLS",
    name: "Setup SQL script exists",
    testFn: () => {
      const pass = fs.existsSync(setupSqlPath);
      return { pass, message: pass ? "File exists" : "Missing supabase-setup.sql" };
    }
  },
  {
    id: "R3-T1-2",
    tier: 1,
    category: "RLS",
    name: "Row Level Security enabled on clientes",
    testFn: () => {
      const regex = /ALTER\s+TABLE\s+(public\.)?clientes\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i;
      const pass = regex.test(sqlContent);
      return { pass, message: pass ? "RLS enabled" : "Missing ENABLE ROW LEVEL SECURITY for clientes table" };
    }
  },
  {
    id: "R3-T1-3",
    tier: 1,
    category: "RLS",
    name: "SELECT Policy defined for clientes",
    testFn: () => {
      const regex = /CREATE\s+POLICY\s+("[^"]+"|\w+)\s+ON\s+(public\.)?clientes\s+FOR\s+SELECT/i;
      const pass = regex.test(sqlContent);
      return { pass, message: pass ? "SELECT policy defined" : "Missing SELECT policy on clientes" };
    }
  },
  {
    id: "R3-T1-4",
    tier: 1,
    category: "RLS",
    name: "INSERT Policy defined for clientes",
    testFn: () => {
      const regex = /CREATE\s+POLICY\s+("[^"]+"|\w+)\s+ON\s+(public\.)?clientes\s+FOR\s+INSERT/i;
      const pass = regex.test(sqlContent);
      return { pass, message: pass ? "INSERT policy defined" : "Missing INSERT policy on clientes" };
    }
  },
  {
    id: "R3-T1-5",
    tier: 1,
    category: "RLS",
    name: "UPDATE Policy defined for clientes",
    testFn: () => {
      const regex = /CREATE\s+POLICY\s+("[^"]+"|\w+)\s+ON\s+(public\.)?clientes\s+FOR\s+UPDATE/i;
      const pass = regex.test(sqlContent);
      return { pass, message: pass ? "UPDATE policy defined" : "Missing UPDATE policy on clientes" };
    }
  },
  {
    id: "R3-T2-1",
    tier: 2,
    category: "RLS",
    name: "DELETE Policy defined for clientes",
    testFn: () => {
      const regex = /CREATE\s+POLICY\s+("[^"]+"|\w+)\s+ON\s+(public\.)?clientes\s+FOR\s+DELETE/i;
      const pass = regex.test(sqlContent);
      return { pass, message: pass ? "DELETE policy defined" : "Missing DELETE policy on clientes" };
    }
  },
  {
    id: "R3-T2-2",
    tier: 2,
    category: "RLS",
    name: "Policies target specific roles anon/authenticated",
    testFn: () => {
      const matches = sqlContent.match(/CREATE\s+POLICY\s+.*?ON\s+(public\.)?clientes.*?FOR\s+(SELECT|INSERT|UPDATE|DELETE).*?TO\s+([^;\n]+)/ig) || [];
      const pass = matches.length > 0 && matches.every(m => m.toLowerCase().includes('anon') || m.toLowerCase().includes('authenticated'));
      return { pass, message: pass ? "Policies are appropriately scoped to roles" : "Some policies are not explicitly scoped to anon/authenticated roles" };
    }
  },
  {
    id: "R3-T2-3",
    tier: 2,
    category: "RLS",
    name: "Dropped policies are recreated (integrity check)",
    testFn: () => {
      const dropMatches = [...sqlContent.matchAll(/DROP\s+POLICY\s+IF\s+EXISTS\s+("([^"]+)"|(\w+))\s+ON/ig)].map(m => m[2] || m[3]);
      const createMatches = [...sqlContent.matchAll(/CREATE\s+POLICY\s+("([^"]+)"|(\w+))\s+ON/ig)].map(m => m[2] || m[3]);
      const pass = dropMatches.every(name => createMatches.includes(name));
      return { pass, message: pass ? "All dropped policies recreated" : "Some policies are dropped but never created" };
    }
  },
  {
    id: "R3-T2-4",
    tier: 2,
    category: "RLS",
    name: "Schema references are consistent",
    testFn: () => {
      const references = [...sqlContent.matchAll(/(ALTER\s+TABLE|CREATE\s+POLICY.*?ON)\s+([\w.]+)/ig)].map(m => m[2]);
      const pass = references.every(ref => ref.startsWith('public.') || !ref.includes('.'));
      return { pass, message: pass ? "Schema references consistent" : "Mixed/incorrect schema scoping detected" };
    }
  },
  {
    id: "R3-T2-5",
    tier: 2,
    category: "RLS",
    name: "Table added to supabase_realtime publication",
    testFn: () => {
      const pass = sqlContent.includes("ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;");
      return { pass, message: pass ? "Table in publication" : "Table public.clientes is not added to supabase_realtime publication" };
    }
  },

  // ==================== REQUIREMENT R4: INPUT SANITIZATION ====================
  {
    id: "R4-T1-1",
    tier: 1,
    category: "SANITIZATION",
    name: "ClientListView.jsx receives searchQuery prop",
    testFn: () => {
      const pass = clientListContent.includes("searchQuery");
      return { pass, message: pass ? "searchQuery received" : "ClientListView.jsx does not expect searchQuery prop" };
    }
  },
  {
    id: "R4-T1-2",
    tier: 1,
    category: "SANITIZATION",
    name: "searchQuery is isolated from database operations",
    testFn: () => {
      const querySection = clientListContent.match(/supabase[\s\S]*?;/g) || [];
      const pass = querySection.every(q => !q.includes('searchQuery'));
      return { pass, message: pass ? "searchQuery isolated from API query" : "searchQuery was used in database request call" };
    }
  },
  {
    id: "R4-T1-3",
    tier: 1,
    category: "SANITIZATION",
    name: "ClientListView filters clients list using local filter function",
    testFn: () => {
      const pass = clientListContent.includes("clientes.filter") && clientListContent.includes("searchQuery");
      return { pass, message: pass ? "Local client filtering used" : "Missing client-side filter logic using searchQuery" };
    }
  },
  {
    id: "R4-T1-4",
    tier: 1,
    category: "SANITIZATION",
    name: "escapeHtml helper is defined in utils.js",
    testFn: () => {
      const pass = utilsJsContent.includes("function escapeHtml") &&
                   utilsJsContent.includes("&amp;") &&
                   utilsJsContent.includes("&lt;") &&
                   utilsJsContent.includes("&gt;");
      return { pass, message: pass ? "escapeHtml correctly defined" : "Missing or incomplete escapeHtml definition" };
    }
  },
  {
    id: "R4-T1-5",
    tier: 1,
    category: "SANITIZATION",
    name: "Variables injected in innerHTML are escaped in app.js",
    testFn: () => {
      const innerHtmlMatches = appJsContent.match(/\.innerHTML\s*=\s*[\s\S]*?;/g) || [];
      const pass = innerHtmlMatches.every(assignment => {
        const interpolations = assignment.match(/\${(.*?)}/g) || [];
        return interpolations.every(interp => {
          const content = interp.slice(2, -1).trim();
          if (content.includes('escapeHtml') ||
              content.includes('fmt') ||
              content.includes('pct') ||
              content.includes('cls')) {
            return true;
          }
          if (/^[a-zA-Z0-9_\s'"(\)]+$/.test(content)) {
            return true;
          }
          // Whitelist safe length properties ending in .length (e.g. detail.columns.length)
          if (/^[a-zA-Z0-9_\s'"(\).]+\.length$/.test(content)) {
            return true;
          }
          return false;
        });
      });
      return { pass, message: pass ? "All innerHTML injections escaped/safe" : "Found unescaped dynamic injection in innerHTML" };
    }
  },
  {
    id: "R4-T2-1",
    tier: 2,
    category: "SANITIZATION",
    name: "ClientListView uses NFD accent normalization for search safety",
    testFn: () => {
      const pass = clientListContent.includes('.normalize("NFD")') && clientListContent.includes('.replace(/[\\u0300-\\u036f]/g');
      return { pass, message: pass ? "Accent normalization used" : "Missing unicode accent normalization in search filtering" };
    }
  },
  {
    id: "R4-T2-2",
    tier: 2,
    category: "SANITIZATION",
    name: "Dropdown options created safely via textContent to prevent XSS",
    testFn: () => {
      const pass = appJsContent.includes('document.createElement(\'option\')') && appJsContent.includes('.textContent =');
      return { pass, message: pass ? "Safe textContent used for options" : "Option elements constructed dynamically via HTML strings" };
    }
  },
  {
    id: "R4-T2-3",
    tier: 2,
    category: "SANITIZATION",
    name: "Attribute values inside innerHTML are properly quoted and escaped",
    testFn: () => {
      const matchAttr = appJsContent.match(/data-dashboard-detail-value\s*=\s*["']\s*\${escapeHtml\(.*?\)}\s*["']/g);
      const pass = matchAttr !== null;
      return { pass, message: pass ? "Attribute interpolation is quoted and escaped" : "Attribute values missing proper escaping / enclosing quotes" };
    }
  },
  {
    id: "R4-T2-4",
    tier: 2,
    category: "SANITIZATION",
    name: "Database record fields are always escaped in app.js innerHTML",
    testFn: () => {
      const dbFields = ['row.cliente', 'row.servicio', 'item.tramite_codigo', 'item.tramite_nombre', 'category.label'];
      const pass = dbFields.every(field => {
        const escapedUse = `escapeHtml(${field}`;
        if (appJsContent.includes(field)) {
          return appJsContent.includes(escapedUse);
        }
        return true;
      });
      return { pass, message: pass ? "Database fields properly escaped" : "Some database fields are directly output to innerHTML without escaping" };
    }
  },
  {
    id: "R4-T2-5",
    tier: 2,
    category: "SANITIZATION",
    name: "Search inputs are trimmed and split to block space bypasses",
    testFn: () => {
      const pass = clientListContent.includes('.trim()') && clientListContent.includes('.split(');
      return { pass, message: pass ? "Whitespace split and trim implemented" : "Search input lacks trimming or space splitting" };
    }
  },

  // ==================== TIER 3: CROSS-FEATURE COMBINATIONS ====================
  {
    id: "CF-T3-1",
    tier: 3,
    category: "CROSS_FEATURE",
    name: "Cross-Feature: Vite environment credentials vs client bundle leak",
    testFn: () => {
      const usesSecret = supabaseClientContent.includes('VITE_SUPABASE_SECRET_KEY') || aiServiceContent.includes('VITE_GROQ_API_KEY');
      const usesProxyOrSafeKeys = supabaseClientContent.includes('VITE_SUPABASE_ANON_KEY');
      const pass = !usesSecret && usesProxyOrSafeKeys;
      return {
        pass,
        message: pass 
          ? "Front-end uses only public keys; sensitive keys (secret_key, groq_api_key) are excluded from client bundle"
          : "Vulnerability: Private credentials (SECRET_KEY or GROQ_API_KEY) are directly loaded in client scripts"
      };
    }
  },
  {
    id: "CF-T3-2",
    tier: 3,
    category: "CROSS_FEATURE",
    name: "Cross-Feature: Supabase RLS Policy vs anonymous mutation permissions",
    testFn: () => {
      const permissiveAnonPolicy = /CREATE POLICY.*ON.*FOR\s+(?:UPDATE|DELETE|ALL|INSERT)\s+TO\s+[^;]*anon[^;]*USING\s*\(\s*true\s*\)/i.test(sqlContent);
      return {
        pass: !permissiveAnonPolicy,
        message: !permissiveAnonPolicy 
          ? "No permissive write/delete RLS policies granted globally to 'anon' users" 
          : "Vulnerability: Permissive write/delete policy found enabling anon TO USING(true) on database tables"
      };
    }
  },
  {
    id: "CF-T3-3",
    tier: 3,
    category: "CROSS_FEATURE",
    name: "Cross-Feature: AI tool calling arguments vs parameterized SQL mapping",
    testFn: () => {
      const rawSqlInterp = /from\(\s*['"]\w+['"]\s*\)[\s\S]*select[\s\S]*\$\{/.test(aiServiceContent);
      const usesSafeBuilders = aiServiceContent.includes(".ilike(") || aiServiceContent.includes(".eq(");
      const pass = !rawSqlInterp && usesSafeBuilders;
      return {
        pass,
        message: pass 
          ? "AI helper database functions utilize safe parameterized postgREST filter methods"
          : "Vulnerability: Dynamic string interpolation detected inside database query selection filters"
      };
    }
  },
  {
    id: "CF-T3-4",
    tier: 3,
    category: "CROSS_FEATURE",
    name: "Cross-Feature: n8n workflow authentication vs REST API tokenization",
    testFn: () => {
      const hasWorkflowWebhookAuth = workflowContent.includes('"authentication":') || workflowContent.includes('"authType":');
      const hasHardcodedBearer = /"value":\s*"Bearer\s+eyJ/i.test(workflowContent);
      const pass = hasWorkflowWebhookAuth && !hasHardcodedBearer;
      return {
        pass,
        message: pass 
          ? "n8n HTTP connections use credentials references instead of hardcoded bearer token strings"
          : "Vulnerability: Webhook configuration is unauthenticated or leaks private JWT authorization headers"
      };
    }
  },

  // ==================== TIER 4: REAL-WORLD SCENARIOS ====================
  {
    id: "RW-T4-1",
    tier: 4,
    category: "REAL_WORLD",
    name: "Real-world: Client-side source key validation for Groq API proxy",
    testFn: () => {
      const usesGroqKeyClientSide = aiServiceContent.includes("Bearer ${getApiKey()}") || aiServiceContent.includes("VITE_GROQ_API_KEY");
      const pass = !usesGroqKeyClientSide;
      return {
        pass,
        message: pass 
          ? "Direct client-side third-party LLM API endpoint invocations are absent" 
          : "Vulnerability: Client scripts send VITE_GROQ_API_KEY directly to api.groq.com; key is exposed to browser"
      };
    }
  },
  {
    id: "RW-T4-2",
    tier: 4,
    category: "REAL_WORLD",
    name: "Real-world: SQL Injection payload sanitization in database queries",
    testFn: () => {
      const trimOrSanitized = aiServiceContent.includes(".replace") || aiServiceContent.includes("trim()") || /if\s*\(!name\s*\|\|\s*name\.trim\(\)\.length\s*===\s*0\)/.test(aiServiceContent);
      return {
        pass: trimOrSanitized,
        message: trimOrSanitized ? "Inputs are validated or trimmed before passing to database builders" : "Vulnerability: Database query inputs are not validated or sanitized"
      };
    }
  },
  {
    id: "RW-T4-3",
    tier: 4,
    category: "REAL_WORLD",
    name: "Real-world: n8n pipeline token leak mitigation check",
    testFn: () => {
      const jwtMatch = /Bearer\s+eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/i.test(workflowContent);
      return {
        pass: !jwtMatch,
        message: !jwtMatch 
          ? "No hardcoded long-lived JWT bearer tokens present in n8n-kommo-workflow.json" 
          : "Vulnerability: Hardcoded bearer token leak detected in workflow json file"
      };
    }
  },
  {
    id: "RW-T4-4",
    tier: 4,
    category: "REAL_WORLD",
    name: "Real-world: AI prompt jailbreak mitigation and context limits",
    testFn: () => {
      const promptConstraint = aiServiceContent.includes("Bajo NINGUNA circunstancia responderás preguntas generales") ||
                                aiServiceContent.includes("SOLO puedes hablar sobre los clientes");
      return {
        pass: promptConstraint,
        message: promptConstraint 
          ? "AI service contains explicit system instructions guarding against jailbreaks and scope escapes" 
          : "Security Warning: AI assistant prompt does not enforce strict system constraints to reject general conversation"
      };
    }
  },
  {
    id: "RW-T4-5",
    tier: 4,
    category: "REAL_WORLD",
    name: "Real-world: SQL Setup restricts anon access to sensitive auditing tables",
    testFn: () => {
      const hasAnonSelectOnHistorial = /GRANT\s+SELECT\s+ON\s+(?:public\.)?historial_cambios\s+TO\s+[^;]*anon/i.test(sqlContent);
      const hasAnonSelectOnChats = /GRANT\s+SELECT\s+ON\s+(?:public\.)?ai_chats\s+TO\s+[^;]*anon/i.test(sqlContent);
      const pass = !hasAnonSelectOnHistorial && !hasAnonSelectOnChats;
      return {
        pass,
        message: pass 
          ? "Access to auditing logs and personal chat logs is restricted to authenticated roles only" 
          : "Vulnerability: SQL setup grants database SELECT permission to anon on sensitive auditing tables (historial_cambios, ai_chats)"
      };
    }
  }
];

module.exports = { tests };
