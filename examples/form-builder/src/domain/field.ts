import { z } from 'zod';
import { RuleSchema } from './conditions';

export const nonBlank = (s: string) => s.trim().length > 0;

export const labelSchema = z.string().refine(nonBlank, 'Label is required');

/** Fields every field type shares. `visible` / `required` are the *default* state. */
export const baseFieldShape = {
  id: z.string().min(1),
  label: labelSchema,
  visible: z.boolean(),
  rules: z.array(RuleSchema),
};

export const optionalCount = (min: number) => z.number().int().min(min).optional();

export function checkOrdered(
  ctx: z.RefinementCtx,
  min: number | undefined,
  max: number | undefined,
  path: string,
  message: string,
) {
  if (min !== undefined && max !== undefined && min > max) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  }
}

export const OptionSchema = z.object({ id: z.string().min(1), label: labelSchema });
export type Option = z.infer<typeof OptionSchema>;

export function checkOptions(ctx: z.RefinementCtx, options: readonly Option[]) {
  const seen = new Set<string>();
  options.forEach((o, i) => {
    const key = o.label.trim().toLowerCase();
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options', i, 'label'],
        message: 'Option labels must be unique',
      });
    }
    seen.add(key);
  });
}

export const FileMetaSchema = z.object({
  name: z.string(),
  size: z.number().nonnegative(),
  type: z.string(),
});
export type FileMeta = z.infer<typeof FileMetaSchema>;
