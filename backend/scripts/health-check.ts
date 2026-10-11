const port = process.env.PORT || "4000";
const url = process.env.HEALTH_URL || `http://127.0.0.1:${port}/health/ready`;

try {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const result = (await response.json()) as {
    data?: { status?: string; database?: boolean };
  };
  if (!response.ok || result.data?.status !== "ready") {
    console.error(`Backend is not ready (${response.status}): ${url}`);
    process.exitCode = 1;
  } else {
    console.log(`Backend is ready: ${url}`);
  }
} catch (error) {
  console.error(
    `Health check failed: ${error instanceof Error ? error.message : "request error"}`,
  );
  process.exitCode = 1;
}
