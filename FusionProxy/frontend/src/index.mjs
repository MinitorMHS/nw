import BareClient from "@tomphttp/bare-client";

const bare = new BareClient();

async function main() {
    const response = await bare.fetch("https://www.google.com/");
    console.log(await response.text());
}

main();
