import { tool } from "ai";
import { z } from "zod";
import {
  ApiRequestError,
  getProducts,
  getProductById,
  getCategories,
  getProductStock,
} from "@/lib/api";
import { start } from "workflow/api";
import { returnFlow } from "./workflows/return-flow";

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