export function strictJsonObjectText(value: unknown) {
    if (typeof value !== "string") return "";
    const text = value.trim();
    const direct = firstJsonObject(text);
    if (direct) return direct;
    const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim() || "";
    return firstJsonObject(fenced);
}

/**
 * 从以 "{" 开头的字符串中提取第一个完整且配平的 JSON 对象。
 * 容忍对象之后附加的任意内容（例如模型重复输出 JSON，或在计划后补充收尾说明），
 * 这类尾随内容会让严格 JSON.parse 报 “Unexpected non-whitespace character after JSON”。
 * 若整体无法解析出一个合法对象则返回空字符串。
 */
function firstJsonObject(text: string): string {
    if (!text.startsWith("{")) return "";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === "{") {
            depth += 1;
            continue;
        }
        if (char === "}") {
            depth -= 1;
            if (depth === 0) {
                const candidate = text.slice(0, index + 1);
                try {
                    JSON.parse(candidate);
                    return candidate;
                } catch {
                    return "";
                }
            }
        }
    }
    return "";
}
