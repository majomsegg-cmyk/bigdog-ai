import { describe, expect, it } from "vitest";

import { strictJsonObjectText } from "./structured-model-output";

describe("strictJsonObjectText", () => {
    it("accepts plain or fenced JSON objects", () => {
        expect(strictJsonObjectText('{"ok":true}')).toBe('{"ok":true}');
        expect(strictJsonObjectText('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
    });

    it("rejects prose and JSON arrays", () => {
        expect(strictJsonObjectText('Use this plan: {"ok":true}')).toBe("");
        expect(strictJsonObjectText("[]")).toBe("");
    });

    it("extracts the first object when the model repeats the output", () => {
        expect(strictJsonObjectText('{"ok":true}{"ok":false}')).toBe('{"ok":true}');
        expect(strictJsonObjectText('{"plan":[1,2]}\n\n{"plan":[3,4]}')).toBe('{"plan":[1,2]}');
    });

    it("extracts the object when the model appends trailing text", () => {
        expect(strictJsonObjectText('{"ok":true} 以上为本次生成计划')).toBe('{"ok":true}');
        expect(strictJsonObjectText('{"ok":true}{')).toBe('{"ok":true}');
    });

    it("keeps object boundaries inside strings or escapes intact", () => {
        expect(strictJsonObjectText('{"a":"}"}')).toBe('{"a":"}"}');
        expect(strictJsonObjectText('{"a":"say \\"hi\\""}')).toBe('{"a":"say \\"hi\\""}');
        expect(strictJsonObjectText("{}")).toBe("{}");
    });

    it("rejects unbalanced or invalid objects", () => {
        expect(strictJsonObjectText('{"a":')).toBe("");
        expect(strictJsonObjectText("{bad}")).toBe("");
        expect(strictJsonObjectText("{")).toBe("");
        expect(strictJsonObjectText("}")).toBe("");
    });
});
