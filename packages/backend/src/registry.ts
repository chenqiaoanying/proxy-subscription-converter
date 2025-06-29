import {registry} from "tsyringe";
import {PrismaBetterSQLite3} from "@prisma/adapter-better-sqlite3";
import {PrismaClient} from "@psc/database";

const adapter = new PrismaBetterSQLite3({
    url: "file:./prisma/dev.db"
});
const prismaClient = new PrismaClient({adapter})

@registry([
    {
        token: "PrismaClient",
        useValue: prismaClient
    }
])
export default class RegistryService {}

