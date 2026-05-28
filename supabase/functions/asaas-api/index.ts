import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Get Asaas config from database
    const { data: configs, error: configError } = await supabaseClient
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['asaas_api_key', 'asaas_ambiente'])

    if (configError || !configs) {
      console.error('Error fetching Asaas config:', configError)
      throw new Error('Could not fetch Asaas configuration')
    }

    const configMap = Object.fromEntries(configs.map(c => [c.chave, c.valor]))
    const apiKey = configMap.asaas_api_key
    const ambiente = configMap.asaas_ambiente

    if (!apiKey) {
      throw new Error('Asaas API key not found in configuration')
    }

    const baseUrl = ambiente === 'sandbox' 
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/api/v3'

    // 2. Parse request body
    let requestData;
    try {
      requestData = await req.json();
    } catch (e) {
      console.error('Error parsing request body:', e);
      throw new Error('Invalid JSON in request body');
    }

    const { path, method, body } = requestData;

    console.log(`Forwarding ${method} request to Asaas: ${path}`)

    // 3. Proxy request to Asaas
    const response = await fetch(`${baseUrl}${path}`, {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing Asaas response as JSON:', responseText);
      return new Response(JSON.stringify({ 
        error: 'Asaas returned non-JSON response',
        status: response.status,
        text: responseText
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response.ok) {
      console.error('Asaas API error:', data)
      return new Response(JSON.stringify({ 
        error: data.errors?.[0]?.description || 'Error from Asaas API',
        details: data 
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Edge Function error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
