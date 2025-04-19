// functions/search.js

exports.handler = async (event) => {
  // pré‑voo CORS
  if (event.httpMethod === "OPTIONS") {
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
    const { codigoDeBarras, city } = JSON.parse(event.body);
    const [latitude, longitude] = city.split(",").map(Number);

    // Chama a API protegida
    const resp = await fetch(
      "http://api.sefaz.al.gov.br/sfz_nfce_api/api/public/consultarPrecosPorCodigoDeBarras",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "AppToken": process.env.APP_TOKEN,
        },
        body: JSON.stringify({ codigoDeBarras, dias: 3, latitude, longitude, raio: 15 }),
      }
    );

    const data = await resp.json();
    return {
      statusCode: resp.ok ? 200 : resp.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };

  } catch (err) {
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
