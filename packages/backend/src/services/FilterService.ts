import {PrismaClient, Prisma} from '@psc/database';
import {singleton} from "tsyringe";
import {FilterSchema} from "@psc/common";
import type {FilterCreateOrUpdate} from "@psc/common";
import FilterCreateInput = Prisma.FilterCreateInput;
import FilterUpdateInput = Prisma.FilterUpdateInput;

@singleton()
export default class FilterService {
    constructor(private readonly prisma: PrismaClient) {
    }

    private toContract(filter: Prisma.FilterGetPayload<{ include: { subscriptions: true } }>) {
        return FilterSchema.parse({
            id: filter.id,
            tag: filter.tag,
            type: filter.type,
            subscriptionIds: filter.subscriptions.map((subscription) => subscription.subscriptionId),
            proxyTypeFilterMode: filter.proxyTypeFilterMode,
            proxyTypes: filter.proxyTypes,
            includePattern: filter.includeRegex,
            excludePattern: filter.excludeRegex,
        });
    }

    private save = async (filterId: number | undefined, filter: FilterCreateOrUpdate) => {
        const upsertInput: FilterCreateInput & FilterUpdateInput = {
            tag: filter.tag,
            type: filter.type,
            proxyTypeFilterMode: filter.proxyTypeFilterMode,
            proxyTypes: filter.proxyTypes.join(),
            excludeRegex: filter.excludePattern,
            includeRegex: filter.includePattern,
            subscriptions: {
                createMany: {
                    data: filter.subscriptionIds?.map(subscriptionId => {
                        return {
                            subscriptionId
                        }
                    }) ?? []
                }
            }
        }

        if (filterId) {
            this.prisma.filterOnSubscription.deleteMany({
                where: {filterId}
            })
            return this.prisma.filter.update({
                where: {id: filterId},
                data: upsertInput,
            });
        } else {
            return this.prisma.filter.create({
                data: upsertInput,
            });
        }
    }

// 创建 Filter
    createFilter = async (filterCreate: FilterCreateOrUpdate) => {
        const savedFilterEntity = await this.save(undefined, filterCreate);
        return {id: savedFilterEntity.id, ...filterCreate};
    }

// 更新 Filter
    updateFilter = async (id: number, filterCreate: FilterCreateOrUpdate) => {
        await this.save(id, filterCreate);
        return {id, ...filterCreate};
    }

// 获取所有 Filter
    listFilters = async () => {
        const filterEntities = await this.prisma.filter.findMany({include: {subscriptions: true}});
        return filterEntities.map((filter) => this.toContract(filter));
    }

// 根据 ID 获取单个 Filter
    getFilterById = async (id: number) => {
        const filterEntity = await this.prisma.filter.findUnique({
            where: {id},
            include: {subscriptions: true}
        });
        if (!filterEntity) {
            return null;
        }
        return this.toContract(filterEntity);
    }

    listFiltersById = async (ids: number[]) => {
        const filterEntities = await this.prisma.filter.findMany({
            where: {id: {in: ids}},
            include: {subscriptions: true}
        });
        return filterEntities.map((filter) => this.toContract(filter));
    }

// 删除 Filter
    deleteFilter = async (id: number) => {
        const deletedFilterEntity = await this.prisma.filter.delete({where: {id}});

        return deletedFilterEntity.id;
    }
}