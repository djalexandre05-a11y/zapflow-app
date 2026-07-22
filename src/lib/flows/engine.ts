import { supabase } from '@/lib/supabase';
import { metaFetch } from '@/lib/meta.functions';

export async function advanceFlowRun(runId: string, incomingMessageText: string, metaToken: string, phoneNumberId: string) {
  // Busca o run atual
  const { data: run, error: runErr } = await supabase.from('flow_runs').select('*').eq('id', runId).single();
  if (runErr || !run) return;

  // Busca o fluxo
  const { data: flow } = await supabase.from('flows').select('*').eq('id', run.flow_id).single();
  if (!flow) return;

  // Busca o nó atual
  const { data: currentNode } = await supabase.from('flow_nodes').select('*').eq('flow_id', flow.id).eq('node_key', run.current_node_key).single();
  if (!currentNode) return;

  // Encontra o proximo no
  let nextNodeKey = null;

  if (currentNode.node_type === 'start') {
    nextNodeKey = currentNode.config.next_node_key;
  } else if (currentNode.node_type === 'send_message') {
    nextNodeKey = currentNode.config.next_node_key;
  } else if (currentNode.node_type === 'condition') {
    const match = currentNode.config.conditions?.find((c: any) => c.value === incomingMessageText);
    nextNodeKey = match ? match.next_node_key : currentNode.config.fallback_node_key;
  } else if (currentNode.node_type === 'send_buttons') {
    const match = currentNode.config.buttons?.find((b: any) => b.label === incomingMessageText);
    nextNodeKey = match ? match.next_node_key : null;
  }

  if (!nextNodeKey) {
    await supabase.from('flow_runs').update({ status: 'completed' }).eq('id', runId);
    return;
  }

  // Pega o proximo no
  const { data: nextNode } = await supabase.from('flow_nodes').select('*').eq('flow_id', flow.id).eq('node_key', nextNodeKey).single();
  if (!nextNode) return;

  // Atualiza
  await supabase.from('flow_runs').update({ current_node_key: nextNodeKey, last_advanced_at: new Date().toISOString() }).eq('id', runId);

  // Executa
  if (nextNode.node_type === 'send_message') {
    await metaFetch(metaToken, `/${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: run.contact_id,
        type: 'text',
        text: { body: nextNode.config.text }
      })
    });
  } else if (nextNode.node_type === 'end') {
    await supabase.from('flow_runs').update({ status: 'completed' }).eq('id', runId);
  }
}

export async function dispatchInboundToFlows(contactPhone: string, messageText: string, metaToken: string, phoneNumberId: string) {
  const { data: activeRun } = await supabase.from('flow_runs').select('*').eq('contact_id', contactPhone).eq('status', 'active').maybeSingle();

  if (activeRun) {
    await advanceFlowRun(activeRun.id, messageText, metaToken, phoneNumberId);
    return true;
  }

  const { data: flows } = await supabase.from('flows').select('*').eq('status', 'active').eq('trigger_type', 'keyword');
  
  if (flows && flows.length > 0) {
    for (const flow of flows) {
      if (flow.trigger_config?.keywords?.includes(messageText)) {
        const { data: newRun } = await supabase.from('flow_runs').insert({
          flow_id: flow.id,
          user_id: flow.user_id,
          contact_id: contactPhone,
          current_node_key: flow.entry_node_id,
          status: 'active'
        }).select().single();

        if (newRun) {
          await advanceFlowRun(newRun.id, '', metaToken, phoneNumberId);
          return true;
        }
      }
    }
  }

  return false;
}
