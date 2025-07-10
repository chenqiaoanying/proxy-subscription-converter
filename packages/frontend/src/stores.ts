import {defineStore} from 'pinia';
import {SubscriptionSchema, FilterSchema, SubscriptionGeneratorSchema} from "@psc/common";
import type {Subscription, Filter, SubscriptionGenerator, FilterCreateOrUpdate, SubscriptionGeneratorCreateOrUpdate} from "@psc/common";
import {readonly, ref} from "vue";
import axios from "axios";

function axiosErrorMapper(error: any): never {
    const errorMsg = error.response?.data?.error;
    if (errorMsg) {
        throw new Error(errorMsg);
    }
    throw error;
}

export const useSubscriptionStore = defineStore('subscription', () => {
    const subscriptionsRef = ref<Subscription[]>([]);

    async function listSubscriptions() {
        return axios.get("/api/subscription", {responseType: 'json'})
            .then(response => (response.data as any[]).map((item) => SubscriptionSchema.parse(item)))
            .catch(axiosErrorMapper);
    }

    async function loadAndSaveProxy(name: string, url: string, userAgent: string) {
        return axios.post("/api/subscription/", {responseType: 'json', params: {name, url, userAgent}})
            .then(response => {
                const savedSubscriptions = SubscriptionSchema.parse(response.data);
                subscriptionsRef.value.push(savedSubscriptions);
                return savedSubscriptions;
            })
            .catch(axiosErrorMapper);
    }


    async function forceReloadSubscriptions() {
        return listSubscriptions().then((result) => subscriptionsRef.value = result);
    }

    async function deleteSubscription(id: number) {
        return await axios.delete(`/api/subscription/${id}`)
            .then(() => subscriptionsRef.value = subscriptionsRef.value.filter(subscription => subscription.id !== id))
            .catch(axiosErrorMapper);
    }

    return {subscriptions: readonly(subscriptionsRef), forceReloadSubscriptions, loadAndSaveProxy, deleteSubscription};
})

export const useFilterStore = defineStore('filter', () => {
    const filtersRef = ref<Filter[]>([]);

    async function listFilters(): Promise<Filter[]> {
        return axios.get("/api/filter", {responseType: 'json'})
            .then(response => {
                return (response.data as any[]).map((item) => FilterSchema.parse(item));
            })
            .catch(axiosErrorMapper);
    }

    async function createFilter(filter: FilterCreateOrUpdate) {
        return axios.post("/api/filter", filter)
            .then(response => {
                const savedFilter = FilterSchema.parse(response.data);
                filtersRef.value.push(savedFilter);
                return savedFilter;
            })
            .catch(axiosErrorMapper);
    }

    async function updateFilter(id: number, filter: FilterCreateOrUpdate) {
        return axios.put(`/api/filter/${id}`, filter)
            .then(response => {
                const savedFilter = FilterSchema.parse(response.data);
                const toReplaceIndex = filtersRef.value.findIndex(filter => filter.id === filter.id);
                if (toReplaceIndex >= 0) {
                    filtersRef.value[toReplaceIndex] = savedFilter;
                } else {
                    filtersRef.value.push(savedFilter);
                }
                return savedFilter;
            })
            .catch(axiosErrorMapper);
    }

    async function deleteFilter(id: number) {
        return axios.delete(`/api/filter/${id}`)
            .then(() => filtersRef.value = filtersRef.value.filter(filter => filter.id !== id))
            .catch(axiosErrorMapper);
    }

    async function forceReloadFilters() {
        const result = await listFilters();
        filtersRef.value = result;
        return result;
    }

    return {filters: readonly(filtersRef), listFilters, createFilter, updateFilter, forceReloadFilters, deleteFilter};
})

export const useSubscriptionGeneratorStore = defineStore('subscriptionGenerator', () => {
    const generatorsRef = ref<SubscriptionGenerator[]>([]);

    async function listGenerators(): Promise<SubscriptionGenerator[]> {
        return axios.get("/api/subscription-generator", {responseType: 'json'})
            .then(response => {
                return (response.data as any[]).map((item) => SubscriptionGeneratorSchema.parse(item));
            })
            .catch(axiosErrorMapper);
    }

    async function createGenerator(generator: SubscriptionGeneratorCreateOrUpdate) {
        return axios.post("/api/subscription-generator", generator)
            .then(response => {
                const savedGenerator = SubscriptionGeneratorSchema.parse(response.data);
                generatorsRef.value.push(savedGenerator);
                return savedGenerator;
            })
            .catch(axiosErrorMapper);
    }

    async function updateGenerator(id: number, generator: SubscriptionGeneratorCreateOrUpdate) {
        return axios.put(`/api/subscription-generator/${id}`, generator)
            .then(response => {
                const updatedGenerator = SubscriptionGeneratorSchema.parse(response.data);
                const index = generatorsRef.value.findIndex(g => g.id === updatedGenerator.id);
                if (index !== -1) {
                    generatorsRef.value[index] = updatedGenerator;
                } else {
                    generatorsRef.value.push(updatedGenerator);
                }
                return updatedGenerator;
            })
            .catch(axiosErrorMapper);
    }

    async function deleteGenerator(id: number) {
        return axios.delete(`/api/subscription-generator/${id}`)
            .then(() => {
                generatorsRef.value = generatorsRef.value.filter(g => g.id !== id);
            })
            .catch(axiosErrorMapper);
    }

    async function generate(id: number) {
        return axios.get(`/api/subscription-generator/generate/${id}`)
            .then(res => {
                return res.data;
            })
            .catch(axiosErrorMapper);
    }

    async function forceReloadGenerators() {
        const result = await listGenerators();
        generatorsRef.value = result;
        return result;
    }

    return {
        generators: readonly(generatorsRef),
        listGenerators,
        createGenerator,
        updateGenerator,
        deleteGenerator,
        forceReloadGenerators,
        generate
    };
});