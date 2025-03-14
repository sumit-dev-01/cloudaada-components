import { Octokit } from "@octokit/rest";
import { MongoClient } from "mongodb";

const octokit = new Octokit({ auth: process.env.CONNECT_GITHUB });
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db("cloudaddaDB");
    const collection = db.collection("components");
    const owner = process.env.REPO_OWNER;
    const repo = process.env.REPO_NAME;
    const path = "for_ci_cd";
    const ref = "cloudadda";

    const { data: contents } = await octokit.rest.repos.getContent({ owner, repo, path, ref });

    for (const file of contents) {
      if (file.name.endsWith(".json")) {
        const { data: fileContent } = await octokit.rest.git.getBlob({ owner, repo, blob_sha: file.sha });
        const decodedContent = Buffer.from(fileContent.content, fileContent.encoding).toString();
        const jsonData = JSON.parse(decodedContent);
        const code = jsonData.code;
        const componentName = file.name.replace(/_/g, ".").replace(".json", "");

        await collection.updateOne(
          { fileName: componentName },
          { $set: { code: code } },
          { upsert: true }
        );

        console.log(`Deployed ${componentName} to MongoDB`);
      }
    }

    console.log("Component deployment complete");
  } catch (err) {
    console.error("Error deploying to MongoDB:", err);
  } finally {
    await client.close();
  }
}

run();