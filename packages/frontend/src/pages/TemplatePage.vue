<script setup lang="ts">

import {ref} from "vue";

const templateType = ref("1");
const subscribeTemplate = ref("");
</script>

<template>

  <el-row>
    <!--一个下拉框，选择 1，提供模板链接；2，自己输入模板-->
    <el-select v-model="templateType" placeholder="请选择模板类型">
      <el-option label="提供模板链接" value="1"/>
      <el-option label="自己输入模板" value="2"/>
    </el-select>
  </el-row>
  <el-row>
    <!--一个用于输入文件模板的文本框-->
    <el-input v-model="subscribeTemplate" placeholder="请输入订阅文件模板" type="textarea" autosize />
  </el-row>
</template>

<style scoped lang="scss">

</style>