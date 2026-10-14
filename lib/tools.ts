import { tool } from "ai";
import { z } from "zod";
import {
  ApiRequestError,
  getProducts,
  getProductById,
  getCategories,
  getProductStock,
  getBackOfficeReturns,
  getBackOfficeSales,
  getBackOfficeStock,
  getBackOfficeSupportTickets,
} from "@/lib/api";
import { start } from "workflow/api";
import { returnFlow } from "./workflows/return-flow";
import { createOrGetSandbox, SANDBOX_NAME } from "@/lib/sandbox";

export const searchProducts = tool({
  description: "Search for products",
  inputSchema: z.object({
    query: z.string()
      .optional()
      .describe(`Optional, free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'. If no query is provided, the user is looking for the most popular products.`),
    category: z.enum([
      "bottles",
      "cups",
      "mugs",
      "desk",
      "stationery",
      "accessories",
      "bags",
      "hats",
      "t-shirts",
      "hoodies",
      "socks",
      "tech",
      "books",
    ])
      .optional()
      .describe(`Optional category slug to filter results. Only set this when the user clearly wants a specific category.`),
  }),
  execute: async ({ query, category }) => {
    "use step";
    try {
      const products = await getProducts({
        search: query,
        category,
        limit: 10,
      });
      return {
        count: products.length,
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.images[0],
          currency: product.currency,
          category: product.category,
          description: product.description,
          slug: product.slug,
        })),
      }
      return products;
    } catch (error) {
      const message = error instanceof ApiRequestError ? error.message : 'Unkown error';
      return { count: 0, products: [], error: message };
    }
  },
});

export const getProductDetails = tool({
  description: `Get more details about a product`,
  inputSchema: z.object({
    id: z.string().describe(`The product's ID or slug, as returned by searchProducts (the id or slug field).`),
  }),
  execute: async ({ id }) => {
    "use step";
    try {
      const [product, stock] = await Promise.all([
        getProductById(id),
        getProductStock(id),
      ]);
      return {
        id: product.id,
        name: product.name,
        price: product.price,
        images: product.images,
        currency: product.currency,
        category: product.category,
        description: product.description,
        slug: product.slug,
        tags: product.tags,
        featured: product.featured,
        stock: stock.stock,
        inStock: stock.inStock,
        lowStock: stock.lowStock,
      };
    }
    catch (error) {
      const message = error instanceof ApiRequestError ? error.message : "Unknown error";
      return { error: message };
    }
  },
});

export const getAllCategories = tool({
  description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
  inputSchema: z.object({}),
  execute: async () => {
    "use step";
    try {
      const categories = await getCategories();
      return {
        count: categories.length,
        categories: categories.map((category) => ({
          slug: category.slug,
          name: category.name,
          productCount: category.productCount,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, categories: [], error: message };
    }
  }
});

export const returnOrder = tool({
  description: `File a return for one of the user's past orders. The user must provide an order ID and a reason. Example order IDs: 11111, 22222, 33333.`,
  inputSchema: z.object({
    orderId: z
      .string()
      .describe("The order ID the user wants to return."),
    reason: z
      .string()
      .min(10)
      .max(500)
      .describe("Why the user is returning the order."),
  }),
  execute: async ({ orderId, reason }) => {
    "use step";
    const run = await start(returnFlow, [orderId, reason]);
    return { runId: run.runId, message: `Return request received for order ${orderId}.` };
  },
});

export const getSupportTickets = tool({
  description: `List support tickets from the back office within a date range. Each ticket includes status, priority, category, assignee (staff username or null when unassigned), the related customer/order, and timestamps. Use this for triaging the support queue, spotting spikes in a category, checking workload by assignee, or auditing unresolved urgent tickets. History covers ~last 180 days. Summarize across the rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
  inputSchema: z.object({
    from: z
      .string()
      .optional()
      .describe(
        `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
      ),
    to: z
      .string()
      .optional()
      .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
    status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    category: z
      .enum([
        "shipping",
        "returns",
        "product_quality",
        "sizing",
        "billing",
        "payment",
        "account",
        "other",
      ])
      .optional(),
    assignee: z
      .string()
      .optional()
      .describe(
        `Staff username (e.g. "alex"). When set, unassigned tickets are excluded.`,
      ),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  execute: async ({
    from,
    to,
    status,
    priority,
    category,
    assignee,
    limit,
  }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeSupportTickets({
        from,
        to,
        status,
        priority,
        category,
        assignee,
        limit,
      });
      return { count: data.length, tickets: data, range: meta };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, tickets: [], error: message };
    }
  },
});
export const getReturnsHistory = tool({
  description: `List historical returns from the back office within a date range. Each entry includes the items returned, the decision (approved/rejected/needs_info), refund amount in cents (divide by 100 for dollar amounts in your reply), and a summary of the related order. Use this for return triage, refund auditing, or identifying products with high return volumes. History covers ~last 180 days. Summarize across the returned rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
  inputSchema: z.object({
    from: z
      .string()
      .optional()
      .describe(
        `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
      ),
    to: z
      .string()
      .optional()
      .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
    status: z.enum(["pending", "processing", "completed"]).optional(),
    decision: z.enum(["approved", "rejected", "needs_info"]).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  execute: async ({ from, to, status, decision, limit }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeReturns({
        from,
        to,
        status,
        decision,
        limit,
      });
      return { count: data.length, returns: data, range: meta };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, returns: [], error: message };
    }
  },
});
export const getInventoryStock = tool({
  description: `Current stock levels for all products (or a subset). Results are sorted by stock ascending, so out-of-stock and low-stock items appear first. Use this to answer questions about availability, restocking priorities, or which items are about to run out. Summarize the rows in your reply rather than dumping them.`,
  inputSchema: z.object({
    productIds: z
      .array(z.string())
      .optional()
      .describe(`Restrict the query to specific product ids.`),
    lowStock: z
      .boolean()
      .optional()
      .describe(
        `true = only items with 1–5 units in stock; false = exclude low-stock items.`,
      ),
    inStock: z
      .boolean()
      .optional()
      .describe(`true = only items with at least one unit; false = only zero.`),
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  execute: async ({ productIds, lowStock, inStock, page, limit }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeStock({
        productIds,
        lowStock,
        inStock,
        page,
        limit,
      });
      return { count: data.length, stock: data, pagination: meta.pagination };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, stock: [], error: message };
    }
  },
});
export const getSalesAnalytics = tool({
  description: `Sales totals by product within a date range. Each row reports unitsSold, ordersCount, and revenue in cents (divide by 100 for dollar amounts in your reply). Results are sorted by unitsSold descending. Pair with getReturnsHistory to compute per-product return rates. Sales data covers ~last 180 days. Summarize across the rows in your reply rather than dumping them; for more than ~10 rows of arithmetic, note that exact joins and aggregates are limited until a sandbox tool is added.`,
  inputSchema: z.object({
    from: z
      .string()
      .optional()
      .describe(
        `ISO 8601 datetime or YYYY-MM-DD. Defaults to 30 days before "to". If the user gives a vague window ("this month", "recently"), pick a sensible range, state it explicitly in your reply, and proceed.`,
      ),
    to: z
      .string()
      .optional()
      .describe(`ISO 8601 datetime or YYYY-MM-DD. Defaults to now.`),
    productId: z
      .string()
      .optional()
      .describe(`Restrict to a single product. 404s if it doesn't exist.`),
  }),
  execute: async ({ from, to, productId }) => {
    "use step";
    try {
      const { data, meta } = await getBackOfficeSales({ from, to, productId });
      return { count: data.length, sales: data, summary: meta };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, sales: [], error: message };
    }
  },
});

export const bash = tool({
  description: "Run a bash command in the sandbox environment",
  inputSchema: z.object({
    summary: z
      .string()
      .describe(
        "A short, plain-English description of what this command does, for a non-technical store admin (e.g. 'Calculating return rates per product'). No jargon, no command names.",
      ),
    command: z.string().describe("The bash command to run"),
  }),
  execute: async ({ command }) => {
    "use step";
    const sandbox = await createOrGetSandbox(SANDBOX_NAME);
    const result = await sandbox.runCommand("bash", ["-lc", command]);
    return {
      stdout: await result.stdout(),
      stderr: await result.stderr(),
      exitCode: result.exitCode,
    };
  },
});