<script setup lang="ts">

import {onMounted, ref} from "vue";
import SubscriptionDialog from "@components/SubscriptionDialog.vue";
import type {SubscriptionDTO} from "@psc/common";

const addSubscriptionDialogVisible = ref(false);
const subscriptionList = ref<SubscriptionDTO[]>([]);

function addSubscription(subscription: SubscriptionDTO) {
  subscriptionList.value.push(subscription);
}

onMounted(() => {
  // 从后端获取订阅列表
  fetch("/api/subscription/list")
    .then(response => response.json())
    .then(data => {
      subscriptionList.value = data;
    });
})
</script>
<template>
  <el-row justify="end">
    <el-button type="primary" @click="addSubscriptionDialogVisible = true">添加订阅链接</el-button>
    <SubscriptionDialog v-model:dialog-visible="addSubscriptionDialogVisible" @subscription-add="addSubscription"/>
  </el-row>
  <el-divider/>
  <el-row>
    <!--卡片列表，每个卡片显示一个订阅链接，点击卡片可以查看订阅内容-->
    <el-card v-for="item in subscriptionList">
      <template #header>
        <div class="card-header">
          <span>{{ item.name }}}</span>
        </div>
      </template>
      <div class="card-content">

      </div>
    </el-card>
  </el-row>
</template>

<style scoped lang="scss">

</style>