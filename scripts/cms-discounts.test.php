<?php
declare(strict_types=1);
require __DIR__ . '/../public/api/cms-core.php';
require __DIR__ . '/../public/api/cms-discounts.php';
$checks = [];
function check($condition, string $name): void { global $checks; $checks[] = ['name'=>$name,'status'=>$condition?'verified':'failed']; }
function rule(string $id, string $type, int $value, array $extra=[]): array { return array_merge(['id'=>$id,'title'=>$id,'type'=>$type,'method'=>'automatic','status'=>'Published','valueType'=>'percent','value'=>$value,'combinesWith'=>['product','order','shipping']],$extra); }
$lines = [['productId'=>'a','quantity'=>1,'amountCents'=>10000],['productId'=>'b','quantity'=>1,'amountCents'=>5000]];
$r = om_discount_evaluate($lines,500,[rule('p','product',2000,['productIds'=>['a']]),rule('o','order',1000),rule('s','shipping',10000)]);
check($r['totalCents']===11700 && $r['discountCents']===3300 && $r['shippingDiscountCents']===500,'Proposal example: 150 - 20 - 13 + free shipping = 117');
check(array_sum($r['lineDiscountCents'])===3300 && array_sum(array_column($r['allocations'],'amountCents'))===3300,'Exact line allocations preserved');
$r=om_discount_evaluate($lines,0,[rule('a','order',2000,['valueType'=>'fixed','combinesWith'=>[]]),rule('b','order',1000,['combinesWith'=>[]])]);
check($r['discountCents']===2000 && $r['applied']===['a'],'Non-combinable rules choose best monetary benefit');
$r=om_discount_evaluate([['productId'=>'a','quantity'=>1,'amountCents'=>3000]],0,[rule('fixed','order',5000,['valueType'=>'fixed'])]);
check($r['totalCents']===0,'Fixed discount cannot make total negative');
$bxy=rule('xy','buyXGetY',10000,['productIds'=>['a'],'rewardProductIds'=>['b'],'buyQuantity'=>2,'getQuantity'=>1,'maxApplications'=>1]);
$r=om_discount_evaluate([['productId'=>'a','quantity'=>2,'amountCents'=>4000],['productId'=>'b','quantity'=>1,'amountCents'=>1000]],0,[$bxy]);
check($r['totalCents']===4000,'Buy two X at 20 and get Y at 10 free');
$r=om_discount_evaluate([['productId'=>'a','quantity'=>2,'amountCents'=>4000]],0,[$bxy]);
check($r['discountCents']===0,'Reward must be present in the cart');
$r=om_discount_evaluate([['productId'=>'a','quantity'=>2,'amountCents'=>4000]],0,[array_merge($bxy,['rewardProductIds'=>['a']])]);
check($r['discountCents']===0,'A unit cannot qualify as both X and reward Y');
$r=om_discount_evaluate([['productId'=>'a','quantity'=>1,'amountCents'=>1000],['productId'=>'b','quantity'=>1,'amountCents'=>2000]],0,[array_merge($bxy,['productIds'=>['a','b'],'buyQuantity'=>1])]);
check($r['discountCents']===2000,'Qualifying X does not consume the only eligible reward');
$r=om_discount_evaluate($lines,0,[rule('code','order',1000,['method'=>'code','code'=>'TEST'])]);
check($r['discountCents']===0,'Manual rule requires entered code');
$r=om_discount_evaluate($lines,0,[rule('code','order',1000,['method'=>'code','code'=>'TEST'])],['codes'=>['test']]);
check($r['discountCents']===1500,'Code matching is case insensitive');
foreach ([['endsAt'=>'2020-01-01T00:00:00Z'],['startsAt'=>'2099-01-01T00:00:00Z'],['status'=>'Draft'],['countries'=>['DE']],['perCustomerLimit'=>1],['usageLimit'=>1]] as $i=>$condition) {
 $r=om_discount_evaluate($lines,0,[rule('deny','order',1000,$condition)],['country'=>'XK','usage'=>['deny'=>1]]);
 check($r['discountCents']===0,'Eligibility guard '.$i);
}
$r=om_discount_evaluate($lines,0,[rule('one','product',1000,['combinesWith'=>['product']]),rule('two','product',2000,['combinesWith'=>['product']])]);
check($r['discountCents']===3000,'No double product discount on the same line');
$r=om_discount_evaluate($lines,0,[rule('one','order',1000,['combinesWith'=>['order']]),rule('two','order',2000,['combinesWith'=>['order']])]);
check($r['discountCents']===4500,'Order percentages use same post-product base');
check(om_allocate_cents(100,[100,100,100])===[34,33,33],'Largest remainder deterministic tie break');
check(om_allocate_cents(500,[10,20])===[10,20],'Allocation is capped at available amount');
for($n=1;$n<=100;$n++){ $weights=[$n*3,$n*7+1,$n*5+2];$amount=$n*2+1;$a=om_allocate_cents($amount,$weights);check(array_sum($a)===min($amount,array_sum($weights)) && min($a)>=0,'Cent conservation '.$n); }
echo json_encode(['checks'=>count($checks),'failed'=>array_values(array_filter($checks,fn($r)=>$r['status']==='failed'))],JSON_PRETTY_PRINT);
exit(count(array_filter($checks,fn($r)=>$r['status']==='failed'))?1:0);
