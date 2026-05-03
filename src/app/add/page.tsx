import MatchBrowser from "@/components/MatchBrowser";
import MatchForm from "@/components/MatchForm";

export default function AddMatchPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Add Match</h1>
      <MatchBrowser />
      <div className="mt-8">
        <MatchForm />
      </div>
    </div>
  );
}
