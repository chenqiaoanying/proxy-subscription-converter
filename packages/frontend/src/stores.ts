import {defineStore} from 'pinia';
import {SubscriptionSchema, FilterSchema, GeneratorSchema} from "@psc/common";
import type {Subscription, Filter, Generator, FilterCreateOrUpdate, GeneratorCreateOrUpdate, SubscriptionCreateOrUpdate} from "@psc/common";
import {readonly, ref} from "vue";
import axios from "axios";
import {z, ZodError} from "zod/v4";

function axiosErrorMapper(error: any): never {
    if (error instanceof ZodError) {
        console.error(z.prettifyError(error));
    } else {
        console.error(error);
    }
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
            .then(response => (response.data as any[]).map(item => SubscriptionSchema.parse(item)))
            .catch(axiosErrorMapper);
    }

    async function createSubscription(subscriptionCreateOrUpdate: SubscriptionCreateOrUpdate) {
        return axios.post("/api/subscription", subscriptionCreateOrUpdate)
            .then(response => {
                const savedSubscription = SubscriptionSchema.parse(response.data);
                subscriptionsRef.value.push(savedSubscription);
                return savedSubscription;
            })
            .catch(axiosErrorMapper);
    }

    async function updateSubscription(id: number, subscriptionCreateOrUpdate: SubscriptionCreateOrUpdate) {
        return axios.put(`/api/subscription/${id}`, subscriptionCreateOrUpdate)
            .then(response => {
                const savedSubscription = SubscriptionSchema.parse(response.data);
                const toReplaceIndex = subscriptionsRef.value.findIndex(subscription => subscription.id === id);
                if (toReplaceIndex >= 0) {
                    subscriptionsRef.value[toReplaceIndex] = savedSubscription;
                } else {
                    subscriptionsRef.value.push(savedSubscription);
                }
                return savedSubscription;
            })
            .catch(axiosErrorMapper);
    }

    async function getSubscription(id: number, refresh: boolean = false) {
        return axios.get(`/api/subscription/${id}`, {params: {refresh}, responseType: 'json'})
            .then(response => {
                const savedSubscription = SubscriptionSchema.parse(response.data);
                const toReplaceIndex = subscriptionsRef.value.findIndex(subscription => subscription.id === id);
                if (toReplaceIndex >= 0) {
                    subscriptionsRef.value[toReplaceIndex] = savedSubscription;
                } else {
                    subscriptionsRef.value.push(savedSubscription);
                }
                return savedSubscription;
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

    return {subscriptions: readonly(subscriptionsRef), forceReloadSubscriptions, createSubscription, deleteSubscription, updateSubscription, getSubscription};
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
                const toReplaceIndex = filtersRef.value.findIndex(filter => filter.id === id);
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

export const useGeneratorStore = defineStore('subscriptionGenerator', () => {
    const generatorsRef = ref<Generator[]>([]);

    async function listGenerators(): Promise<Generator[]> {
        return axios.get("/api/generator", {responseType: 'json'})
            .then(response => {
                return (response.data as any[]).map((item) => GeneratorSchema.parse(item));
            })
            .catch(axiosErrorMapper);
    }

    async function createGenerator(generator: GeneratorCreateOrUpdate) {
        return axios.post("/api/generator", generator)
            .then(response => {
                const savedGenerator = GeneratorSchema.parse(response.data);
                generatorsRef.value.push(savedGenerator);
                return savedGenerator;
            })
            .catch(axiosErrorMapper);
    }

    async function updateGenerator(id: number, generator: GeneratorCreateOrUpdate) {
        return axios.put(`/api/generator/${id}`, generator)
            .then(response => {
                const updatedGenerator = GeneratorSchema.parse(response.data);
                const index = generatorsRef.value.findIndex(g => g.id === id);
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
        return axios.delete(`/api/generator/${id}`)
            .then(() => {
                generatorsRef.value = generatorsRef.value.filter(g => g.id !== id);
            })
            .catch(axiosErrorMapper);
    }

    async function generate(id: number) {
        return axios.get(`/api/generator/generate/${id}`)
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
