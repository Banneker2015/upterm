import {readFileSync} from "fs";
import {Job} from "./Job";
import * as events from "events";
import {PluginManager} from "../PluginManager";
import {ApplicationComponent} from "../views/ApplicationComponent";
import {Environment, processEnvironment} from "./Environment";
import {
    homeDirectory, normalizeDirectory,
    presentWorkingDirectoryFilePath,
} from "../utils/Common";
import {OrderedSet} from "../utils/OrderedSet";
import {Aliases, aliasesFromConfig} from "./Aliases";
import * as _ from "lodash";
import {Prompt} from "./Prompt";

export type SessionID = number & {__isSessionID: true};

export class Session extends events.EventEmitter {
    readonly id: SessionID = <SessionID>Date.now();
    jobs: Array<Job> = [];
    readonly environment = new Environment(processEnvironment);
    readonly aliases = new Aliases(aliasesFromConfig);
    historicalPresentDirectoriesStack = new OrderedSet<string>();

    constructor(private application: ApplicationComponent, private _dimensions: Dimensions = {columns: 80, rows: 25}) {
        super();

        // TODO: We want to deserialize properties only for the first instance
        // TODO: of Session for the application.
        this.deserialize();
    }

    createJob(prompt: Prompt): void {
        const job = new Job(this, prompt);
        job.execute();

        job.once("end", () => {
            this.emit("job-finished");
            this.emit("jobs-changed");
        });

        this.jobs.push(job);
        this.emit("jobs-changed");
    }

    get dimensions(): Dimensions {
        return this._dimensions;
    }

    set dimensions(value: Dimensions) {
        this._dimensions = value;
        this.jobs.forEach(job => job.resize());
    }

    get lastJob(): Job | undefined {
        return _.last(this.jobs);
    }

    clearJobs(): void {
        this.jobs = [];
        this.emit("jobs-changed");
    }

    close(): void {
        // FIXME: executing `sleep 5 && exit` and switching to another session will close an incorrect one.
        this.application.closeFocusedSession();
    }

    get directory(): string {
        return this.environment.pwd;
    }

    set directory(value: string) {
        let normalizedDirectory = normalizeDirectory(value);
        if (normalizedDirectory === this.directory) {
            return;
        }

        PluginManager.environmentObservers.forEach(observer =>
            observer.presentWorkingDirectoryWillChange(this, normalizedDirectory),
        );

        this.environment.pwd = normalizedDirectory;
        this.historicalPresentDirectoriesStack.prepend(normalizedDirectory);

        PluginManager.environmentObservers.forEach(observer =>
            observer.presentWorkingDirectoryDidChange(this, normalizedDirectory),
        );
    }

    private deserialize(): void {
        this.directory = this.readSerialized(presentWorkingDirectoryFilePath, homeDirectory);
    }

    private readSerialized<T>(file: string, defaultValue: T): T {
        try {
            return JSON.parse(readFileSync(file).toString());
        } catch (error) {
            return defaultValue;
        }
    }
}
