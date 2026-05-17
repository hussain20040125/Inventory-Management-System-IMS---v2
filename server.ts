import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import http from "http";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./server/db";
import apiRoutes from "./server/routes";
import { initBroadcaster } from "./server/broadcaster";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  // Connect to MongoDB
  await connectDB();

  app.set('trust proxy', 1);

  // Initialize WebSocket broadcaster
  initBroadcaster(server);

  // Improved CORS for AIS environment
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API routes
  app.use("/api", apiRoutes);

  // Serve static files from uploads directory
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: path.join(process.cwd(), "frontend"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Try multiple possible paths for the dist folder
    const possibleDistPaths = [
      path.join(process.cwd(), "dist/public"),
      path.join(process.cwd(), "dist"),
      path.join(process.cwd(), "frontend/dist")
    ];

    let distPath = "";
    for (const p of possibleDistPaths) {
      if (fs.existsSync(p) && fs.readdirSync(p).length > 0) {
        distPath = p;
        break;
      }
    }

    if (distPath) {
      console.log(`Serving static files from: ${distPath}`);
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        if (req.path.startsWith("/api/")) {
          return res.status(404).json({ success: false, message: `API route not found: ${req.method} ${req.path}` });
        }
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.warn("WARNING: No dist directory found. Static files will be served by Vite if in dev mode.");
    }
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
