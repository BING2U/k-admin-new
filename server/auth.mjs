import { existsSync, readFileSync } from "node:fs";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

const cwd = process.cwd();
loadDotEnv(resolve(cwd, ".env"));
loadDotEnv(resolve(cwd, ".env.local"));
loadDotEnv(resolve(cwd, `.env.${process.env.NODE_ENV || "development"}`));
loadDotEnv(resolve(cwd, `.env.${process.env.NODE_ENV || "development"}.local`));

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readEnv(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : value;
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(body);
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function formatExpires(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function createAdminAuth() {
  const username = readEnv("ADMIN_USERNAME", "admin");
  const password = readEnv("ADMIN_PASSWORD");
  const salt = randomBytes(16);
  const passwordHash = password ? scryptSync(password, salt, 64) : null;
  const tokenSecret = passwordHash
    ? passwordHash.toString("hex")
    : randomBytes(32).toString("hex");

  if (!password) {
    console.warn(
      "[k-admin] ADMIN_PASSWORD is not set. Login will be rejected until you copy .env.example to .env.local."
    );
  } else {
    console.info(`[k-admin] seeded local user "${username}" (scrypt hash at runtime)`);
  }

  function sign(kind, name, exp) {
    const payload = `${kind}.${name}.${exp}`;
    const sig = createHmac("sha256", tokenSecret).update(payload).digest("hex");
    return `${payload}.${sig}`;
  }

  function verifyToken(token, kind) {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 4) return null;
    const [gotKind, name, exp, sig] = parts;
    if (gotKind !== kind) return null;
    const payload = `${gotKind}.${name}.${exp}`;
    const expected = createHmac("sha256", tokenSecret).update(payload).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Number(exp) <= Date.now()) return null;
    if (name !== username) return null;
    return { username: name, exp: Number(exp) };
  }

  function issueSession(name) {
    const accessExp = Date.now() + TOKEN_TTL_MS;
    const refreshExp = Date.now() + REFRESH_TTL_MS;
    return {
      avatar: "",
      username: name,
      nickname: name,
      roles: ["admin"],
      permissions: ["*:*:*"],
      accessToken: sign("access", name, accessExp),
      refreshToken: sign("refresh", name, refreshExp),
      expires: formatExpires(accessExp)
    };
  }

  function checkPassword(user, pass) {
    if (!passwordHash || !password) return false;
    if (typeof user !== "string" || typeof pass !== "string") return false;
    if (user !== username) return false;
    const candidate = scryptSync(pass, salt, 64);
    return timingSafeEqual(candidate, passwordHash);
  }

  async function handleLogin(req, res) {
    const body = await readJsonBody(req);
    if (!password) {
      json(res, 200, {
        success: false,
        message: "未配置 ADMIN_PASSWORD，请复制 .env.example 为 .env.local 后重试"
      });
      return;
    }
    if (!checkPassword(body.username, body.password)) {
      json(res, 200, { success: false, message: "用户名或密码错误" });
      return;
    }
    json(res, 200, { success: true, data: issueSession(username) });
  }

  async function handleRefresh(req, res) {
    const body = await readJsonBody(req);
    const parsed = verifyToken(body.refreshToken, "refresh");
    if (!parsed) {
      json(res, 200, { success: false, data: {} });
      return;
    }
    const accessExp = Date.now() + TOKEN_TTL_MS;
    json(res, 200, {
      success: true,
      data: {
        accessToken: sign("access", parsed.username, accessExp),
        refreshToken: sign("refresh", parsed.username, Date.now() + REFRESH_TTL_MS),
        expires: formatExpires(accessExp)
      }
    });
  }

  async function middleware(req, res, next) {
    const url = req.url?.split("?")[0] ?? "";
    if (
      req.method === "GET" &&
      (url === "/get-async-routes" || url.endsWith("/get-async-routes"))
    ) {
      json(res, 200, { success: true, data: [] });
      return;
    }
    if (req.method === "POST" && (url === "/login" || url.endsWith("/login"))) {
      try {
        await handleLogin(req, res);
      } catch (error) {
        json(res, 500, { success: false, message: String(error) });
      }
      return;
    }
    if (
      req.method === "POST" &&
      (url === "/refresh-token" || url.endsWith("/refresh-token"))
    ) {
      try {
        await handleRefresh(req, res);
      } catch (error) {
        json(res, 500, { success: false, message: String(error) });
      }
      return;
    }
    next();
  }

  return { middleware, username };
}

export function resolveApiBaseUrl() {
  return (
    readEnv("K_DATA_API_BASE_URL") ||
    readEnv("VITE_API_BASE_URL") ||
    "http://127.0.0.1:28080"
  );
}
