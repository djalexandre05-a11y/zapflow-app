const ptBR: Record<string, any> = {
  "Flows.builder.canvasView": "Quadro Visual",
  "Flows.builder.listView": "Modo Lista",
  "Flows.builder.addNode": "Adicionar Nó",
  "Flows.editorState.modeAdd": "Adicionar",
  "Flows.editorState.modeRemove": "Remover",
  "Flows.editorState.media": "Mídia",
  "Flows.validate.noIssues": "Sem problemas",
  "Flows.validate.summary": "{errorCount} erros e {warningCount} avisos",
  "Flows.builder.categories.messaging": "MENSAGENS",
  "Flows.builder.categories.logic": "LÓGICA E DADOS",
  "Flows.builder.categories.flow": "CONTROLE DE FLUXO",
  "Flows.builder.nodes.start.label": "Início",
  "Flows.builder.nodes.start.blurb": "Ponto de entrada",
  "Flows.builder.nodes.send_message.label": "Mensagem",
  "Flows.builder.nodes.send_message.blurb": "Enviar texto simples",
  "Flows.builder.nodes.send_buttons.label": "Botões",
  "Flows.builder.nodes.send_buttons.blurb": "Enviar texto com botões interativos",
  "Flows.builder.nodes.send_list.label": "Menu Lista",
  "Flows.builder.nodes.send_list.blurb": "Menu de opções (até 10 itens)",
  "Flows.builder.nodes.send_media.label": "Mídia",
  "Flows.builder.nodes.send_media.blurb": "Imagem, vídeo, áudio ou PDF",
  "Flows.builder.nodes.collect_input.label": "Entrada",
  "Flows.builder.nodes.collect_input.blurb": "Aguardar texto do cliente",
  "Flows.builder.nodes.condition.label": "Condição",
  "Flows.builder.nodes.condition.blurb": "Decidir baseado em variável",
  "Flows.builder.nodes.set_tag.label": "Tag",
  "Flows.builder.nodes.set_tag.blurb": "Adicionar ou remover tag",
  "Flows.builder.nodes.handoff.label": "Atendente",
  "Flows.builder.nodes.handoff.blurb": "Passar para atendimento humano",
  "Flows.builder.nodes.end.label": "Fim",
  "Flows.builder.nodes.end.blurb": "Encerrar o fluxo",
};

export function useTranslations(namespace?: string) {
  const t = (key: string, values?: Record<string, any>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    let text = ptBR[fullKey];
    
    if (!text) {
      const parts = key.split('.');
      text = parts[parts.length - 1];
    }

    if (values && text) {
      for (const [k, v] of Object.entries(values)) {
        text = text.replace('{'+k+'}', String(v));
      }
    }
    return text || key;
  };
  t.rich = (key: string, values?: Record<string, any>) => {
    return t(key, values);
  };
  return t;
}
