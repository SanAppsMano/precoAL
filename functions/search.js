// functions/search.js

exports.handler = async (event) => {
  // Log the incoming event for debugging
  console.log("Received event:", JSON.stringify(event));

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    console.log("Preflight request, returning CORS headers");
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }

  try {
    console.log("Parsing request body");
    const { codigoDeBarras, city } = JSON.parse(event.body);
    console.log("Parsed values:", { codigoDeBarras, city });

    const [latitude, longitude] = city.split(",").map(Number);
    console.log("Coordinates parsed:", { latitude, longitude });

    const apiUrl = "http://api.sefaz.al.gov.br/sfz_nfce_api/api/public/consultarPrecosPorCodigoDeBarras";
    console.log("Calling external API at:", apiUrl);

    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "AppToken": process.env.APP_TOKEN,
      },
      body: JSON.stringify({
        codigoDeBarras,
        dias: 3,
        latitude,
        longitude,
        raio: 15,
      }),
    });

    console.log("External API response status:", resp.status, resp.statusText);

    const data = await resp.json();
    console.log("External API returned data:", JSON.stringify(data));

    const statusCode = resp.ok ? 200 : resp.status;
    console.log("Returning status code:", statusCode);

    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };

  } catch (err) {
    console.error("Error in handler:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
