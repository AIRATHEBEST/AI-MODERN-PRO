/**
 * Image Generation — DALL-E 3, Stability AI, Flux
 */
export interface ImageGenRequest {
  prompt: string;
  provider: "openai" | "stability" | "flux";
  model?: string;
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  apiKey: string;
  baseUrl?: string;
}

export interface ImageGenResult {
  imageUrl: string;
  revisedPrompt?: string;
  provider: string;
  model: string;
}

export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
  switch (req.provider) {
    case "openai": return generateDallE(req);
    case "stability": return generateStability(req);
    case "flux": return generateFlux(req);
    default: throw new Error(`Unknown image provider: ${req.provider}`);
  }
}

async function generateDallE(req: ImageGenRequest): Promise<ImageGenResult> {
  const model = req.model || "dall-e-3";
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({
      model,
      prompt: req.prompt,
      n: 1,
      size: req.size || "1024x1024",
      quality: req.quality || "standard",
      style: req.style || "vivid",
      response_format: "url",
    }),
  });
  if (!response.ok) throw new Error(`DALL-E error ${response.status}: ${await response.text()}`);
  const data = await response.json() as any;
  return { imageUrl: data.data[0].url, revisedPrompt: data.data[0].revised_prompt, provider: "openai", model };
}

async function generateStability(req: ImageGenRequest): Promise<ImageGenResult> {
  const model = req.model || "stable-diffusion-3-medium";
  const formData = new FormData();
  formData.append("prompt", req.prompt);
  formData.append("output_format", "webp");
  const response = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/core`, {
    method: "POST",
    headers: { Authorization: `Bearer ${req.apiKey}`, Accept: "image/*" },
    body: formData,
  });
  if (!response.ok) throw new Error(`Stability AI error ${response.status}: ${await response.text()}`);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return { imageUrl: `data:image/webp;base64,${base64}`, provider: "stability", model };
}

async function generateFlux(req: ImageGenRequest): Promise<ImageGenResult> {
  const baseUrl = req.baseUrl || "https://api.bfl.ml";
  const model = req.model || "flux-pro-1.1";
  const response = await fetch(`${baseUrl}/v1/${model}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Key": req.apiKey },
    body: JSON.stringify({ prompt: req.prompt, width: 1024, height: 1024 }),
  });
  if (!response.ok) throw new Error(`Flux error ${response.status}: ${await response.text()}`);
  const task = await response.json() as { id: string };
  // Poll for result
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await fetch(`${baseUrl}/v1/get_result?id=${task.id}`, {
      headers: { "X-Key": req.apiKey },
    });
    const result = await poll.json() as any;
    if (result.status === "Ready") return { imageUrl: result.result.sample, provider: "flux", model };
    if (result.status === "Error") throw new Error(`Flux generation failed: ${result.error}`);
  }
  throw new Error("Flux generation timed out");
}
