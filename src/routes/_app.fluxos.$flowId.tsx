import { createFileRoute } from '@tanstack/react-router';
import { FlowEditorShell } from '@/components/flows/flow-editor-shell';

export const Route = createFileRoute('/_app/fluxos/$flowId')({
  component: FlowEditorPage,
});

function FlowEditorPage() {
  const { flowId } = Route.useParams();

  return <FlowEditorShell flowId={flowId} />;
}
