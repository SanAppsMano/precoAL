// Função leve só para health check
exports.handler = async () => {
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', timestamp: Date.now() })
    };
  };
  