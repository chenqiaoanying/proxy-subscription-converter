import {defineStore} from 'pinia';
import {SubscriptionSchema} from "@psc/common";
import type {SubscriptionDTO} from "@psc/common";
import {readonly, ref} from "vue";
import axios from "axios";

export const subscriptionsStore = defineStore('subscription', () => {
    const subscriptionRef = ref<SubscriptionDTO[]>([]);

    async function listSubscriptions(): Promise<SubscriptionDTO[]> {
        return await fetch("/api/subscription/list")
            .then(response => response.json())
            .then(data => {
                return (data as any[]).map((item) => SubscriptionSchema.parse(item));
            }).catch(error => {
                console.error('Error fetching subscriptions:', error);
                throw error;
            });
    }

    async function loadAndSaveProxy(name: string, url: string, userAgent: string): Promise<void> {
        axios.get("/api/subscription/load-and-save-proxy", {responseType: 'json', params: {name, url, userAgent}})
            .then(response => {
                if (!response.data.error) {
                    throw new Error(response.data.error);
                }
                subscriptionRef.value?.push(SubscriptionSchema.parse(response.data));
            })
    }


    async function forceReloadSubscriptions(): Promise<void> {
        listSubscriptions().then((result) => subscriptionRef.value = result);
    }

    return {subscriptions: readonly(subscriptionRef), forceReloadSubscriptions, loadAndSaveProxy}
})