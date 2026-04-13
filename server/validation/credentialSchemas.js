const { z } = require('zod');

const credentialCreateSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1).max(128),
  username: z.string().min(1).max(128),
  password: z.string().min(8).max(512)
});

const credentialUpdateSchema = credentialCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required for update.' }
);

const confirmationSchema = z.object({
  confirmationToken: z.string().min(24).max(256)
});

module.exports = {
  credentialCreateSchema,
  credentialUpdateSchema,
  confirmationSchema
};
