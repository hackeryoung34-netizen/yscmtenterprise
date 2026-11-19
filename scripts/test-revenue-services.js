const crypto = require("node:crypto");
const { neon } = require("@neondatabase/serverless");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");

async function main() {
  const required = [
    "REVENUE_DATABASE_URL",
    "AWS_ENDPOINT_URL_S3",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION"
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment keys: ${missing.join(", ")}`);
  }

  const sql = neon(process.env.REVENUE_DATABASE_URL);
  const rows = await sql`select 1 as ok`;
  if (Number(rows[0]?.ok) !== 1) throw new Error("Neon Postgres query did not return the expected result.");
  process.stdout.write("Postgres connectivity: PASS\n");

  const bucket = process.env.REVENUE_ASSETS_BUCKET || "yscmt-revenue-assets";
  const client = new S3Client({
    region: process.env.AWS_REGION,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  const key = `health-check/${crypto.randomUUID()}.txt`;
  const marker = `yscmt-revenue-storage-check:${crypto.randomUUID()}`;
  let uploaded = false;

  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: marker,
      ContentType: "text/plain"
    }));
    uploaded = true;

    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const received = await response.Body.transformToString();
    if (received !== marker) throw new Error("Object Storage read-back did not match the uploaded test data.");
    process.stdout.write("Object Storage PUT/GET: PASS\n");
  } finally {
    if (uploaded) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      process.stdout.write("Object Storage DELETE cleanup: PASS\n");
    }
    client.destroy();
  }
}

main().catch((error) => {
  process.stderr.write(`Revenue service smoke test failed: ${error.message}\n`);
  process.exitCode = 1;
});
