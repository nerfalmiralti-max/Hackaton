import { auth } from "@/auth";
import { authConfigured, authEnabled } from "@/lib/server/auth-config";
import { AuthGate } from "@/components/auth-gate";
import { Workspace } from "@/components/workspace";
export default async function Page() {
	const enabled = authEnabled();
	const configured = authConfigured();
	const session = enabled && configured ? await auth() : null;
	const identity = session?.user?.email ? { name: session.user.name, email: session.user.email, image: session.user.image } : null;
	return <AuthGate enabled={enabled} configured={configured} initialSession={identity}><Workspace /></AuthGate>;
}
