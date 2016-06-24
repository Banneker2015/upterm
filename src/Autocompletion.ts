import {Job} from "./Job";
import {leafNodeAt} from "./shell/Parser";

export const suggestionsLimit = 9;

export const {getSuggestions} = new class {

    getSuggestions = async (job: Job, caretPosition: number) => {
        const node = leafNodeAt(caretPosition, job.prompt.ast);
        const suggestions = await node.suggestions({
            environment: job.environment,
            historicalCurrentDirectoriesStack: job.session.historicalCurrentDirectoriesStack,
            aliases: job.session.aliases,
        });

        return suggestions.filter(suggestion => tokensComparator(node.value, suggestion.value)).slice(0, suggestionsLimit);
    };
};

function tokensComparator(real: string, suggested: string) {
    const shouldPerformSmartCaseComparison = real === real.toLowerCase();

    if (shouldPerformSmartCaseComparison) {
        return suggested.toLowerCase().startsWith(real);
    } else {
        return suggested.startsWith(real);
    }
}
