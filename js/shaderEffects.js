// Adapted from spark: https://github.com/sparkjsdev/spark 

import { dyno } from "@sparkjsdev/spark";

export function createShaderEffects(splatMesh, effectParams, animateT) {
  splatMesh.objectModifier = dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => {
      const d = new dyno.Dyno({
        inTypes: { gsplat: dyno.Gsplat, t: "float", effectType: "int", intensity: "float" },
        outTypes: { gsplat: dyno.Gsplat },
        globals: () => [dyno.unindent(`
         // Pseudo-random hash function
          mat2 rot(float a){ float s=sin(a),c=cos(a);return mat2(c,-s,s,c); }

          vec3 hash2(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(vec3(p.x * p.y * p.z, p.x + p.y * p.z, p.x * p.y + p.z));
          }

          // 3D Perlin-style noise function
          vec3 noise2(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            
            vec3 n000 = hash2(i + vec3(0,0,0));
            vec3 n100 = hash2(i + vec3(1,0,0));
            vec3 n010 = hash2(i + vec3(0,1,0));
            vec3 n110 = hash2(i + vec3(1,1,0));
            vec3 n001 = hash2(i + vec3(0,0,1));
            vec3 n101 = hash2(i + vec3(1,0,1));
            vec3 n011 = hash2(i + vec3(0,1,1));
            vec3 n111 = hash2(i + vec3(1,1,1));
            
            vec3 x0 = mix(n000, n100, f.x);
            vec3 x1 = mix(n010, n110, f.x);
            vec3 x2 = mix(n001, n101, f.x);
            vec3 x3 = mix(n011, n111, f.x);
            
            vec3 y0 = mix(x0, x1, f.y);
            vec3 y1 = mix(x2, x3, f.y);
            
            return mix(y0, y1, f.z);
          }

          // Twister weather effect
          vec4 twister(vec3 pos, vec3 scale, float t) {
            float h = hash2(pos).x + .1;
            float s = smoothstep(0., 8., t*t*.1 - length(pos.xz)*2.+2.);
            if (length(scale) < .05) pos.y = mix(-10., pos.y, pow(s, 2.*h));
            pos.xz = mix(pos.xz*.5, pos.xz, pow(s, 2.*h));
            pos.xz *= rot(t*.2 + pos.y*20.*(1.-s)*exp(-1.*length(pos.xz)));
            return vec4(pos, s*s*s*s);
          }

          // Rain weather effect
          vec4 rain(vec3 pos, vec3 scale, float t) {
            vec3 h = hash2(pos);
            float s = pow(smoothstep(0., 5., t*t*.1 - length(pos.xz)*2. + 1.), .5 + h.x);
            float y = pos.y;
            pos.y = min(-10. + s*15., pos.y);
            pos.x += pos.y*.2;
            pos.xz = mix(pos.xz*.3, pos.xz, s);
            pos.xz *= rot(t*.3);
            return vec4(pos, smoothstep(-10., y, pos.y));
          }

          vec3 hash(vec3 p){ return fract(sin(p*123.456)*123.456); }

          vec3 headMovement(vec3 pos,float t){ pos.xy*=rot(smoothstep(-1.,-2.,pos.y)*.2*sin(t*2.));return pos; }
          vec3 breathAnimation(vec3 pos,float t){
            float b=sin(t*1.5);
            pos.yz*=rot(smoothstep(-1.,-3.,pos.y)*.15*-b);
            pos.z+=.3;pos.y+=1.2;
            pos*=1.+exp(-3.*length(pos))*b;
            pos.z-=.3;pos.y-=1.2;return pos;
          }

          // --- Perlin noise helpers ---
          float noise(vec3 p){
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f*f*(3.0-2.0*f);
            vec3 u = f*f*(3.0-2.0*f);
            return mix(mix(mix(dot(hash(i + vec3(0.,0.,0.)), f - vec3(0.,0.,0.)),
                              dot(hash(i + vec3(1.,0.,0.)), f - vec3(1.,0.,0.)), u.x),
                          mix(dot(hash(i + vec3(0.,1.,0.)), f - vec3(0.,1.,0.)),
                              dot(hash(i + vec3(1.,1.,0.)), f - vec3(1.,1.,0.)), u.x), u.y),
                      mix(mix(dot(hash(i + vec3(0.,0.,1.)), f - vec3(0.,0.,1.)),
                              dot(hash(i + vec3(1.,0.,1.)), f - vec3(1.,0.,1.)), u.x),
                          mix(dot(hash(i + vec3(0.,1.,1.)), f - vec3(0.,1.,1.)),
                              dot(hash(i + vec3(1.,1.,1.)), f - vec3(1.,1.,1.)), u.x), u.y), u.z);
          }

          vec3 perlinMotion(vec3 pos, float t, float intensity){
            pos += vec3(
              noise(pos + t*0.3),
              noise(pos + t*0.4 + 5.0),
              noise(pos + t*0.5 + 10.0)
            ) * intensity * 0.2; // subtle movement
            return pos;
          }
            
          vec4 fractal1(vec3 pos,float t,float intensity){
            float m=100.;vec3 p=pos*.1;p.y+=.5;
            for(int i=0;i<8;i++){
              p=abs(p)/clamp(abs(p.x*p.y),0.3,3.)-1.;
              p.xy*=rot(radians(90.));
              if(i>1)m=min(m,length(p.xy)+step(.3,fract(p.z*.5+t*.5+float(i)*.2)));
            }
            m=step(m,0.5)*1.3*intensity;
            return vec4(-pos.y*.3,0.5,0.7,.3)*intensity+m;
          }

          vec4 fractal2(vec3 center,vec3 scales,vec4 rgba,float t,float intensity){
            vec3 pos=center;float splatSize=length(scales);
            float pattern=exp(-50.*splatSize);
            vec3 p=pos*.65;pos.y+=2.;
            float c=0.;float l,l2=length(p);float m=100.;
            for(int i=0;i<10;i++){
              p.xyz=abs(p.xyz)/dot(p.xyz,p.xyz)-.8;
              l=length(p.xyz);
              c+=exp(-1.*abs(l-l2)*(1.+sin(t*1.5+pos.y)));
              l2=length(p.xyz);
              m=min(m,length(p.xyz));
            }
            c=smoothstep(0.3,0.5,m+sin(t*1.5+pos.y*.5))+c*.1;
            return vec4(vec3(length(rgba.rgb))*vec3(c,c*c,c*c*c)*intensity,rgba.a*exp(-20.*splatSize)*m*intensity);
          }

          vec4 sin3D(vec3 p,float t){ float m=exp(-2.*length(sin(p*2.+t*3.)))*5.;return vec4(m)+.3; }
          vec4 disintegrate(vec3 pos,float t,float intensity){
            vec3 p=pos+(hash(pos)*2.-1.)*intensity;
            float tt=smoothstep(-1.,0.5,-sin(t+-pos.y*.5));
            p.xz*=rot(tt*2.+p.y*2.*tt);
            return vec4(mix(p,pos,tt),tt);
          }
          vec4 flare(vec3 pos,float t){
            vec3 p=vec3(0.,-1.5,0.);
            float tt=smoothstep(-1.,.5,sin(t+hash(pos).x));
            tt*=tt;p.x+=sin(t*2.)*tt;p.z+=sin(t*2.)*tt;p.y+=sin(t)*tt;
            return vec4(mix(pos,p,tt),tt);
          }

          vec3 windMotion(vec3 pos, float t, float intensity, vec3 windDir){
          // Normalize wind direction
          vec3 dir = normalize(windDir);

          // Subtle oscillation along the wind
          float sway = sin(t + dot(pos, dir)*0.5) * 0.1;

          // Offset position along wind + sway
          pos += dir * intensity * 0.5 + dir * sway * intensity;

          return pos;
        }

        `)],
        statements: ({ inputs, outputs }) => dyno.unindentLines(`
          ${outputs.gsplat}=${inputs.gsplat};
          vec3 localPos=${inputs.gsplat}.center;
          vec3 splatScales=${inputs.gsplat}.scales;
          vec4 splatColor=${inputs.gsplat}.rgba;
          float l = length(localPos.xz);
          float t = ${inputs.t};
          float s = smoothstep(0.,10.,t-4.5)*10.;

          if(${inputs.effectType}==1){
            //Electronic
            ${outputs.gsplat}.center=headMovement(localPos,${inputs.t});
            vec4 e=fractal1(localPos,${inputs.t},${inputs.intensity});
            ${outputs.gsplat}.rgba= mix(splatColor,splatColor*e,${inputs.intensity});
          }
          else if(${inputs.effectType}==2){
            // Deep Meditation
            vec4 e=fractal2(localPos,splatScales,splatColor,${inputs.t},${inputs.intensity});
            ${outputs.gsplat}.rgba= mix(splatColor,e,${inputs.intensity});
            ${outputs.gsplat}.center=breathAnimation(localPos,${inputs.t});
          }
          else if(${inputs.effectType}==3){
            // Waves
            vec4 e=sin3D(localPos,${inputs.t});
            ${outputs.gsplat}.rgba= mix(splatColor,splatColor*e,${inputs.intensity});
          }
          else if(${inputs.effectType}==4){
            // disintegrate
            vec4 e=disintegrate(localPos,${inputs.t},${inputs.intensity});
            ${outputs.gsplat}.center=e.xyz;
            ${outputs.gsplat}.scales=mix(vec3(.01),${inputs.gsplat}.scales,e.w);
          }
          else if(${inputs.effectType}==5){
           // Flare
            vec4 e=flare(localPos,${inputs.t});
            ${outputs.gsplat}.center=e.xyz;
            ${outputs.gsplat}.rgba.rgb=mix(splatColor.rgb,vec3(1.),abs(e.w));
            ${outputs.gsplat}.rgba.a=mix(splatColor.a,0.3,abs(e.w));
          }
          else if(${inputs.effectType}==6){
            // Wind          
          vec3 windDir = vec3(1.0, 0.0, 0.0); // default X-axis
          ${outputs.gsplat}.center = windMotion(localPos, ${inputs.t}, ${inputs.intensity}, windDir);

          // Optional: slight color shift based on wind intensity
          ${outputs.gsplat}.rgba.rgb = mix(splatColor.rgb, splatColor.rgb + vec3(0.02,0.05,0.08)*${inputs.intensity}, 0.3);
          }
          else if (${inputs.effectType} == 7) {
              // Magic Effect: Complex twister with noise and radial reveal
              float border = abs(s-l-.5);
              localPos *= 1.-.2*exp(-20.*border);
              vec3 finalScales = mix(splatScales,vec3(0.001),smoothstep(s-.5,s,l+.5));
              ${outputs.gsplat}.center = localPos + .1*noise2(localPos.xyz*2.+t*.5)*smoothstep(s-.5,s,l+.5);
              ${outputs.gsplat}.scales = finalScales;
              float at = atan(localPos.x,localPos.z)/3.1416;
              ${outputs.gsplat}.rgba *= step(at,t-3.1416);
              ${outputs.gsplat}.rgba += exp(-20.*border) + exp(-50.*abs(t-at-3.1416))*.5;
              
              }
          else if (${inputs.effectType} == 8 ) {
 
              vec4 e=sin3D(localPos,${inputs.t});
              ${outputs.gsplat}.rgba= mix(splatColor,splatColor*e,${inputs.intensity});
          
              vec3 noiseOffset = ${inputs.waveAmplitute} * noise2(localPos.xyz * ${inputs.waveFrequency} + t * ${inputs.waveSpeed});
              localPos += noiseOffset;
              ${outputs.gsplat}.center = localPos;

              if(${inputs.scaleBlend}<0.1){
                
                ${outputs.gsplat}.scales = vec3(0.001);

              }else{

                ${outputs.gsplat}.scales = splatScales * ${inputs.scaleBlend};                          
                }
            
              }
        `),
      });

      
      const effectTypeMap = {
        "Electronic": 1,
        "Deep Meditation": 2,
        "Waves": 3,
        "Disintegrate": 4,
        "Flare": 5,
        "Wind":6,
        "Magic": 7,
        "Perlin Wave": 8
      };

      const effectType = effectTypeMap[effectParams.effect] || 1;

      gsplat = d.apply({
        gsplat,
        t: animateT,
        effectType: dyno.dynoInt(effectType),
        intensity: dyno.dynoFloat(effectParams.intensity),
        scaleBlend: dyno.dynoFloat(effectParams.scaleBlend), 
        waveFrequency: dyno.dynoFloat(effectParams.waveFrequency),
        waveAmplitute: dyno.dynoFloat(effectParams.waveAmplitute),
        waveSpeed: dyno.dynoFloat(effectParams.waveSpeed),
      }).gsplat;

      return { gsplat };
    }
  );

  splatMesh.updateGenerator();
}