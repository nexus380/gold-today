exports.handler = async function(event, context) {
  const KEY = process.env.GOLDAPI_KEY;

  if (!KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GOLDAPI_KEY not set' })
    };
  }

  try {
    const response = await fetch('https://www.goldapi.io/api/XPT/USD', {
      headers: {
        'x-access-token': KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('GoldAPI error: ' + response.status);

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        price: data.price,
        prev_close_price: data.prev_close_price,
        ch: data.ch,
        chp: data.chp,
        timestamp: data.timestamp
      })
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: err.message })
    };
  }
};
