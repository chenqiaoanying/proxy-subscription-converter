import {registry} from "tsyringe";
import {PrismaBetterSQLite3} from "@prisma/adapter-better-sqlite3";
import {PrismaClient} from "@psc/database";
import path from "path";

const dbUrl = "file:" + path.resolve("../database/prisma/dev.db")

const adapter = new PrismaBetterSQLite3({
    url: dbUrl
});
const prismaClient = new PrismaClient({adapter})

@registry([
    {
        token: PrismaClient,
        useValue: prismaClient,
    }
])
export default class RegistryService {}

