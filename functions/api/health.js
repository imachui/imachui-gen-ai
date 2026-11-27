export async function onRequest(context) {
  const { env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Dito natin ilalagay yung logic mo para sa health check
    // Pansinin: 'process.env' ay pinalitan ng 'env'
    
    // ... (kopyahin mo yung logic sa loob ng GET mo sa lumang health.js)
    // Basta palitan ang res.status().json() ng return new Response(JSON.stringify(...))
    
    // Pansamantala, ibabalik muna natin ito para di mag-error:
    return new Response(JSON.stringify({ status: 'ok', message: 'Health check ready' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
