import {defineStore} from 'pinia';
import {SubscriptionSchema, FilterSchema} from "@psc/common";
import type {Subscription, Filter} from "@psc/common";
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
            .then(response => {
                return (response.data as any[]).map((item) => SubscriptionSchema.parse(item));
            })
            .catch(axiosErrorMapper);
    }

    async function loadAndSaveProxy(name: string, url: string, userAgent: string): Promise<void> {
        axios.get("/api/subscription/load-and-save", {responseType: 'json', params: {name, url, userAgent}})
            .then(response => {
                subscriptionsRef.value.push(SubscriptionSchema.parse(response.data));
            })
            .catch(axiosErrorMapper);
    }


    async function forceReloadSubscriptions(): Promise<void> {
        listSubscriptions().then((result) => subscriptionsRef.value = result);
    }

    return {subscriptions: readonly(subscriptionsRef), forceReloadSubscriptions, loadAndSaveProxy}
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

    async function saveFilters(filter: Filter) {
        return axios.post("/api/filter", filter)
            .then(response => {
                filtersRef.value.push(FilterSchema.parse(response.data));
            })
            .catch(axiosErrorMapper);
    }

    return {filters: readonly(filtersRef), listFilters, saveFilters}
})